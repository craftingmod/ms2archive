import asyncio
import base64
import json
import mitmproxy

from mitmproxy import ctx, tcp, http
import mitmproxy.addonmanager
import mitmproxy.addons
import websockets
from typing import cast, List, Dict, TypedDict

from websockets import connect
from websockets.protocol import State

class HTTPLogger:
  def request(self, flow: http.HTTPFlow): 
    ctx.log.info(f"Request: {flow.request.url}")
    
addons = [
  HTTPLogger()
]