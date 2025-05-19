#Requires AutoHotkey v2.0
#SingleInstance

global g_isSendingActive := false ; Z 보내기 기능의 현재 상태 (false = OFF, true = ON)
global g_notepadWindowClass := "ahk_class MapleStory2"

; GUI 생성
MyGui := Gui(, "Z 보내기 토글")
MyGui.SetFont("s10") ; 사용자 환경에 맞게 글꼴 크기 조절 가능
g_toggleButton := MyGui.Add("Button", "w300 h60", "Z 보내기 시작")
g_toggleButton.OnEvent("Click", ToggleZAction)
MyGui.OnEvent("Close", GuiClose)
MyGui.Show()

ToggleZAction(GuiCtrlObj, Info) {
    global g_isSendingActive, g_toggleButton
    g_isSendingActive := !g_isSendingActive ; 상태 토글

    if (g_isSendingActive) {
        g_toggleButton.Text := "Z 보내기 중지"
        ; #HotIf 조건이 g_isSendingActive를 포함하므로,
        ; 이 값이 true로 바뀌고 Notepad가 활성화되면 타이머가 자동으로 활성화됩니다.
    } else {
        g_toggleButton.Text := "Z 보내기 시작"
        ; g_isSendingActive가 false가 되면 #HotIf 조건이 false가 되어 타이머가 자동으로 비활성화됩니다.
    }
}

SetTimer PressZ, 400

PressZ() {
    ; Notepad 창이 여전히 활성 상태인지 확인합니다.
    ; WinActive는 두 가지 다른 클래스 이름을 확인할 수 있습니다.
    ; Windows 10 및 이전 버전의 Notepad는 "Notepad" 클래스 이름을 사용합니다.
    ; Windows 11의 Notepad는 "CASCADIA_HOSTING_WINDOW_CLASS" 클래스 이름을 사용합니다.
    if (WinActive(g_notepadWindowClass) and g_isSendingActive) {
        Send("{z down}")
        Sleep(200)
        Send("{z up}")
    } else {
        ; Notepad가 활성화되어 있지 않으면 타이머를 끕니다.
        ; SetTimer PressZ, 0
    }
}

GuiClose(GuiObj) {
    ExitApp ; GUI 창을 닫으면 스크립트 종료
}

; 스크립트 종료를 위한 단축키 (선택 사항)
^!x::ExitApp ; Ctrl+Alt+X를 누르면 스크립트 종료
