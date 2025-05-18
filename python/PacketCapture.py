import asyncio
import base64
import json
import mitmproxy

from mitmproxy import ctx, tcp # http는 사용되지 않으므로 제거
import mitmproxy.addonmanager
import mitmproxy.addons
import websockets
from typing import cast, List, Dict, TypedDict

from websockets import connect
from websockets.protocol import State

# 필터링할 서버 IP 주소 (환경에 맞게 수정)
filterIP = "192.168.3.157" # 예시 IP, 실제 환경에 맞게 변경하세요.
websocketURL = "ws://localhost:3210"
WEBSOCKET_RECONNECT_DELAY = 5  # 초
WEBSOCKET_RESPONSE_TIMEOUT = 3 # 초 (Node.js 응답 대기 시간)

# TypedDict for better type hinting of the splitTCPPacket return value
class SplitPacketResult(TypedDict):
  packets: List[bytes]
  remaining: bytes

# 서버로부터 받는 응답 형식 (예시)
class WebSocketResponse(TypedDict):
  messageId: str
  modified_segments_base64: List[str] | None
  error: str | None

class MS2PacketCapture:
  connection: websockets.ClientConnection | None = None
  packetBuffer: dict[str, bytes] = {}
  pending_responses: dict[str, asyncio.Future[WebSocketResponse]] = {}
  _listener_task: asyncio.Task | None = None
  _connecting_lock = asyncio.Lock()
  _is_connecting_or_connected: bool = False
  
  def load(self, loader:mitmproxy.addonmanager.Loader):
    """mitmproxy 애드온 로드"""
    ctx.log.info("MS2PacketCapture addon loading. Initializing WebSocket connection.")
    self.pending_responses = {}
    self.packetBuffer = {}
    asyncio.create_task(self._ensure_websocket_connection_and_listener())
  
  async def tcp_start(self, flow: tcp.TCPFlow):
    """TCP 연결 시작시 호출"""
    ctx.log.debug(f"[MS2PacketCapture] Connection {flow.id}: Client {flow.client_conn.address} -> Server {flow.server_conn.address}")
    
    self.packetBuffer[flow.id] = b""
    
    # 연결 상태 확인 및 필요시 연결 시도 (리스너 시작 포함)
    await self._ensure_websocket_connection_and_listener()

    if not self.isWebSocketOpen():
      return
    
    try:
      flow_event_data = {
        "event": "flow_start",
        "flowId": flow.id,
        "client_address": list(flow.client_conn.address), # tuple을 list로 변환
        "server_address": list(flow.server_conn.address), # tuple을 list로 변환
        "timestamp": int(flow.client_conn.timestamp_start * 1000)
      }
      await self.connection.send(json.dumps(flow_event_data))
      
    except Exception as e:
      ctx.log.error(f"Error sending flow_start for {flow.id}: {e}")
      
  async def tcp_message(self, flow: tcp.TCPFlow):
    s_ip, s_port = flow.server_conn.address
    c_ip, c_port = flow.client_conn.address
        
    handlePacket = False
    if s_ip == filterIP and (20000 <= s_port <= 33000):
      handlePacket = True
    if c_ip == filterIP and (20000 <= c_port <= 33000):
      handlePacket = True
        
    if not handlePacket:
      return
    
    # 연결 상태 확인 및 필요시 연결 시도 (리스너 시작 포함)
    await self._ensure_websocket_connection_and_listener()
    
    if not self.isWebSocketOpen():
      ctx.log.warn(f"WebSocket not connected for flow {flow.id}. Original message will pass through.")
      return
    
    await self.handleMessage(flow)
  
  async def handleMessage(self, flow: tcp.TCPFlow):
    message = flow.messages[-1]
    fromClient = cast(bool, message.from_client)  
    packetBodyRaw = cast(bytes, message.content)
    flowID = flow.id
    
    if len(packetBodyRaw) == 0:
      return
    
    segment_id = f"{flow.id}_{len(flow.messages) - 1}"
    
    current_data_for_processing = self.packetBuffer.get(flowID, b"") + packetBodyRaw
      
    splittedBody = MS2PacketCapture.splitTCPPacket(current_data_for_processing)
    
    # 다음 메세지를 위한 버퍼 설정
    remaningPacket = splittedBody["remaining"]
    self.packetBuffer[flowID] = remaningPacket
    
    if len(remaningPacket) > 0:
      ctx.log.info(f"Remaining Packets: {len(remaningPacket)} bytes.")
      
    # 한번에 보내기
    encodedBody = [
      base64.b64encode(packet).decode('utf-8')
      for packet in splittedBody["packets"]
    ]
    
    # 완성된 패킷이 없는 경우에는 "" 반환 (현재는 유효하지 않은 패킷)
    # 또는 원본 데이터를 그대로 두거나, 상황에 따라 처리
    if len(encodedBody) == 0:
      message.content = b"" # 빈 세그먼트 출력 (유효한 패킷이 완성되면 나중에 출력)
      return
    
    segmentDataToSend = {
      "event": "flow_message",
      "messageId": segment_id,
      "flowId": flowID,
      "direction": "client_to_server" if fromClient else "server_to_client",
      "segments": encodedBody,
      "timestamp": int(message.timestamp * 1000)
    }
    
    if not self.isWebSocketOpen() or self.connection is None:
      ctx.log.error(f"WebSocket connection lost before sending for flow {flowID}, segment {segment_id}.")
      # 원본 메시지 사용 또는 빈 내용으로 설정
      # message.content = packetBodyRaw # 또는 b""
      return

    response_future = asyncio.Future[WebSocketResponse]()
    self.pending_responses[segment_id] = response_future

    try:
      await self.connection.send(json.dumps(segmentDataToSend))
      
      # Future를 통해 _websocket_listener로부터 응답 대기
      ws_response = await asyncio.wait_for(response_future, timeout=WEBSOCKET_RESPONSE_TIMEOUT)
      
      if ws_response.get("error"):
        ctx.log.error(f"Error from WebSocket server for {segment_id}: {ws_response['error']}")
        # 오류 시 원본 사용 또는 빈 내용으로 설정
        # message.content = packetBodyRaw
        return

      modified_segments_b64 = ws_response.get("modified_segments_base64")
      if modified_segments_b64:
        reassembled_content = b"".join(base64.b64decode(s) for s in modified_segments_b64)
        message.content = reassembled_content
        ctx.log.info(f"Segment {segment_id} modified by WebSocket. Original len: {len(packetBodyRaw)}, New len: {len(reassembled_content)}")
      else:
        ctx.log.info(f"Segment {segment_id} not modified by WebSocket (no modified_segments_base64). Using original.")
        # 원본 사용 (이미 packetBodyRaw가 message.content에 있음, 또는 명시적으로 설정)
        # message.content = packetBodyRaw

    except asyncio.TimeoutError:
      ctx.log.warn(f"Timeout waiting for WebSocket response for segment {segment_id}. Using original content.")
      self.pending_responses.pop(segment_id, None) # 타임아웃 시 Future 제거
      # message.content = packetBodyRaw
    except websockets.exceptions.ConnectionClosed as e:
      ctx.log.error(f"WebSocket connection closed during send/recv for {segment_id}: {e}. Using original content.")
      await self._handle_websocket_disconnect() # 연결 해제 처리 및 재연결 시도
      # message.content = packetBodyRaw
    except Exception as e:
      ctx.log.error(f"Error during WebSocket send/recv for {segment_id}: {e}. Using original content.")
      # message.content = packetBodyRaw
    finally:
      # 성공, 타임아웃, 또는 다른 예외 발생 시에도 Future가 남아있으면 제거
      self.pending_responses.pop(segment_id, None)

  async def _ensure_websocket_connection_and_listener(self):
    async with self._connecting_lock:
      if self._is_connecting_or_connected and self.isWebSocketOpen():
        return # 이미 연결 시도 중이거나 연결됨
      self._is_connecting_or_connected = True

    ctx.log.info(f"Attempting to connect to WebSocket server at {websocketURL}...")
    try:
      self.connection = await websockets.connect(websocketURL) # type: ignore
      ctx.log.info("Successfully connected to WebSocket server.")
      
      if self._listener_task and not self._listener_task.done():
        self._listener_task.cancel()
        try:
          await self._listener_task
        except asyncio.CancelledError:
          ctx.log.info("Previous WebSocket listener task cancelled.")
      
      self._listener_task = asyncio.create_task(self._websocket_listener())
      # 연결 성공 후에는 _is_connecting_or_connected를 True로 유지 (연결 해제 시 False로)
    except (websockets.exceptions.WebSocketException, ConnectionRefusedError, OSError) as e:
      ctx.log.error(f"WebSocket connection failed: {e}. Retrying in {WEBSOCKET_RECONNECT_DELAY} seconds.")
      await self._handle_websocket_disconnect(schedule_reconnect=False) # 현재 연결 시도 실패 처리
      await asyncio.sleep(WEBSOCKET_RECONNECT_DELAY)
      asyncio.create_task(self._ensure_websocket_connection_and_listener()) # 재연결 시도
    except Exception as e:
      ctx.log.error(f"An unexpected error occurred during WebSocket connection: {e}")
      await self._handle_websocket_disconnect(schedule_reconnect=False)

  async def _websocket_listener(self):
    if not self.connection:
      ctx.log.error("WebSocket listener started without a connection.")
      await self._handle_websocket_disconnect()
      return
    
    ctx.log.info("WebSocket listener started.")
    try:
      async for message_str in self.connection:
        try:
          response_data = json.loads(message_str)
          message_id = response_data.get("messageId")
          
          if message_id in self.pending_responses:
            future = self.pending_responses.pop(message_id)
            # WebSocketResponse 타입으로 캐스팅하거나, 필요한 필드를 추출하여 future에 설정
            # 여기서는 서버가 WebSocketResponse TypedDict 형식으로 응답한다고 가정
            typed_response: WebSocketResponse = {
                "messageId": message_id,
                "modified_segments_base64": response_data.get("modified_segments_base64"),
                "error": response_data.get("error")
            }
            future.set_result(typed_response)
          else:
            ctx.log.warn(f"Received WebSocket message for unknown/timed-out messageId: {message_id}")
        except json.JSONDecodeError:
          ctx.log.error(f"Failed to decode JSON from WebSocket: {message_str[:200]}")
        except Exception as e:
          ctx.log.error(f"Error processing message from WebSocket: {e}")
    except websockets.exceptions.ConnectionClosed as e:
      ctx.log.warn(f"WebSocket connection closed by server (or network issue): {e.reason} (code: {e.code})")
    except Exception as e:
      ctx.log.error(f"WebSocket listener error: {e}")
    finally:
      ctx.log.info("WebSocket listener stopped.")
      await self._handle_websocket_disconnect()

  async def _handle_websocket_disconnect(self, schedule_reconnect: bool = True):
    """WebSocket 연결 해제 시 처리 및 재연결 로직"""
    self._is_connecting_or_connected = False # 연결 시도/상태 플래그 해제
    if self.connection and not self.connection.state == State.CLOSED:
      try:
        await self.connection.close()
      except Exception as e:
        ctx.log.error(f"Error closing WebSocket connection: {e}")
    self.connection = None
    
    if self._listener_task and not self._listener_task.done():
      self._listener_task.cancel()
      try:
        await self._listener_task
      except asyncio.CancelledError:
        pass # Listener task cancelled as expected
    self._listener_task = None
        
    for msg_id, future in list(self.pending_responses.items()):
      if not future.done():
        future.set_exception(ConnectionAbortedError(f"WebSocket disconnected for {msg_id}"))
      self.pending_responses.pop(msg_id, None)
    
    if schedule_reconnect:
      ctx.log.info(f"Attempting to reconnect to WebSocket in {WEBSOCKET_RECONNECT_DELAY} seconds...")
      await asyncio.sleep(WEBSOCKET_RECONNECT_DELAY) # 재연결 전 딜레이
      asyncio.create_task(self._ensure_websocket_connection_and_listener())
  
  def isHandlePacket(self, flow: tcp.TCPFlow):
    s_ip, s_port = flow.server_conn.address
    c_ip, c_port = flow.client_conn.address
        
    if s_ip == filterIP and (20000 <= s_port <= 33000):
      return True
    if c_ip == filterIP and (20000 <= c_port <= 33000):
      return True
    
    return False
  
  def isWebSocketOpen(self):
    if self.connection is None:
      return False
    
    return self.connection.state == State.OPEN
    
  @staticmethod
  def splitTCPPacket(packet_bytes: bytes, flow_id_for_log: str = "N/A") -> SplitPacketResult:
    """
      `{ushort}{uint-패킷길이}{패킷내용}` 내용대로 자릅니다.
      (Header: 2 bytes, Length: 4 bytes (little-endian, for payload), Payload: variable)
      
      @param packet_bytes: The input bytes which may contain one or more complete packets,
                           and/or partial packet data at the end.
      @return: A dictionary containing:
               "packets": A list of byte strings, each being a complete packet 
                          (header + length_field + payload).
               "remaining": A byte string of any leftover data that couldn't form 
                            a complete packet.
    """
    complete_packets: List[bytes] = []
    current_pos = 0
    total_data_len = len(packet_bytes)

    while current_pos < total_data_len:
      # Minimum length required for header (2 bytes) + length field (4 bytes) = 6 bytes
      if total_data_len - current_pos < 6:
        # Not enough data for even the basic header + length field.
        # The rest of the data is considered 'remaining'.
        break

      # The header is packet_bytes[current_pos : current_pos + 2]
      # The length field is packet_bytes[current_pos + 2 : current_pos + 6]
      # This length field specifies the length of the "패킷내용" (payload) part.
      try:
        # Read payload_length (little-endian unsigned integer from 4 bytes)
        payload_length = int.from_bytes(packet_bytes[current_pos + 2 : current_pos + 6], byteorder='little')
      except Exception as e:
        # This might occur if the data stream is severely corrupted, making the 4 bytes
        # uninterpretable as an integer, though highly unlikely for a simple int.from_bytes
        # if the slice is guaranteed to be 4 bytes.
        # Log the error and treat the rest of the data from current_pos as 'remaining'.
        ctx.log.warn( # Error에서 Warn으로 변경, 너무 치명적인 오류는 아닐 수 있음
          f"MS2PacketCapture.splitTCPPacket: Error parsing payload_length. "
          f"Exception: {e}. "
          f"Data slice (hex): {packet_bytes[current_pos : current_pos + 6].hex()}. "
          f"Stopping parse for this chunk."
        )
        break 

      # Total length of the current application packet:
      # 2 (header) + 4 (length_field) + payload_length
      current_app_packet_total_length = 6 + payload_length
        
      # Sanity check for payload_length.
      # As it's "uint", it should be >= 0. int.from_bytes (unsigned) ensures this.
      # An excessively large length might also indicate issues or an OOM vector if not checked,
      # but the primary check is whether we have enough data.
      if payload_length < 0: # Should not happen for an unsigned int.
        ctx.log.warn(
          f"MS2PacketCapture.splitTCPPacket: Parsed a negative payload_length ({payload_length}), which is unexpected for uint. "
          f"Data (hex): {packet_bytes[current_pos : current_pos + 6].hex()}. "
          f"Stopping parse for this chunk."
        )
        break

      # Check if the buffer (from current_pos) contains the complete current application packet
      if total_data_len - current_pos < current_app_packet_total_length:
        # Not enough data for the full packet (header + length_field + payload).
        # The rest of the data from current_pos is part of an incomplete packet.
        break

      # Extract the complete application packet
      one_complete_packet = packet_bytes[current_pos : current_pos + current_app_packet_total_length]
      complete_packets.append(one_complete_packet)

      # Move the position to the start of the next potential packet
      current_pos += current_app_packet_total_length

    remaining_data = packet_bytes[current_pos:]
    return {"packets": complete_packets, "remaining": remaining_data}

  def tcp_end(self, flow: tcp.TCPFlow) -> None:
    """TCP 연결 종료시 호출"""
    ctx.log.debug(f"[MS2PacketCapture] Connection ended: {flow.id}")
    self.packetBuffer.pop(flow.id, None) # 해당 플로우 버퍼 정리

    # 해당 플로우에 대한 대기 중인 Future 정리
    keys_to_remove = [k for k in self.pending_responses if k.startswith(f"{flow.id}_")]
    for key in keys_to_remove:
        future = self.pending_responses.pop(key, None)
        if future and not future.done():
            future.cancel() # 또는 future.set_exception(FlowTerminatedError(...))
            ctx.log.debug(f"Cancelled pending future for {key} due to flow end.")

    if self.isWebSocketOpen() and self.connection:
        try:
            flow_event_data = {"event": "flow_end", "flowId": flow.id}
            # tcp_end는 동기 컨텍스트일 수 있으므로, 이벤트 루프에서 실행되도록 태스크 생성
            asyncio.create_task(self.connection.send(json.dumps(flow_event_data)))
        except Exception as e:
            ctx.log.error(f"Error sending flow_end for {flow.id} to WebSocket: {e}")

  def done(self):
    """mitmproxy 애드온 종료 시 호출"""
    ctx.log.info("MS2PacketCapture addon shutting down.")
    asyncio.create_task(self._handle_websocket_disconnect(schedule_reconnect=False)) # 모든 정리 작업 수행


addons = [MS2PacketCapture()]
