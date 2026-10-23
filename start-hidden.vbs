' 匿名版编辑器 —— 静默启动（不显示黑窗口），并自动打开浏览器
' 用法：双击本文件即可。停止服务请双击 stop.bat
Option Explicit

Dim sh, fso, dir
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)

sh.CurrentDirectory = dir
' 第二个参数 0 = 隐藏窗口
sh.Run "cmd /c node server.js --open", 0, False
