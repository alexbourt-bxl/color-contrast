param(
  [int] $TimeoutMs = 60000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$source = @"
using System;
using System.Runtime.InteropServices;
using System.Threading;

public static class PixelPicker
{
  private const int WH_MOUSE_LL = 14;
  private const int WH_KEYBOARD_LL = 13;
  private const int WM_LBUTTONDOWN = 0x0201;
  private const int WM_LBUTTONUP = 0x0202;
  private const int WM_KEYDOWN = 0x0100;
  private const int VK_ESCAPE = 0x1B;

  private static IntPtr _mouseHookId = IntPtr.Zero;
  private static IntPtr _keyboardHookId = IntPtr.Zero;
  private static LowLevelMouseProc _mouseProc = MouseHookCallback;
  private static LowLevelKeyboardProc _keyboardProc = KeyboardHookCallback;

  private static ManualResetEventSlim _done = new ManualResetEventSlim(false);
  private static volatile bool _canceled = false;

  private static int _count = 0;
  private static int[] _x = new int[2];
  private static int[] _y = new int[2];
  private static uint[] _rgb = new uint[2];

  public static int Run(int timeoutMs)
  {
    _count = 0;
    _canceled = false;
    _done.Reset();

    _mouseHookId = SetWindowsHookEx(WH_MOUSE_LL, _mouseProc, GetModuleHandle(null), 0);
    _keyboardHookId = SetWindowsHookEx(WH_KEYBOARD_LL, _keyboardProc, GetModuleHandle(null), 0);

    if (_mouseHookId == IntPtr.Zero || _keyboardHookId == IntPtr.Zero)
    {
      CleanupHooks();
      return 3;
    }

    bool completed = _done.Wait(timeoutMs);
    CleanupHooks();

    if (!completed)
    {
      return 4;
    }

    if (_canceled)
    {
      return 2;
    }

    Console.WriteLine(ToJson());
    return 0;
  }

  private static void CleanupHooks()
  {
    if (_mouseHookId != IntPtr.Zero)
    {
      UnhookWindowsHookEx(_mouseHookId);
      _mouseHookId = IntPtr.Zero;
    }

    if (_keyboardHookId != IntPtr.Zero)
    {
      UnhookWindowsHookEx(_keyboardHookId);
      _keyboardHookId = IntPtr.Zero;
    }
  }

  private static IntPtr MouseHookCallback(int nCode, IntPtr wParam, IntPtr lParam)
  {
    if (nCode >= 0 && !_canceled && _count < 2 &&
        (wParam == (IntPtr)WM_LBUTTONDOWN || wParam == (IntPtr)WM_LBUTTONUP))
    {
      if (wParam == (IntPtr)WM_LBUTTONDOWN)
      {
        MSLLHOOKSTRUCT hookStruct = (MSLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(MSLLHOOKSTRUCT));
        int px = hookStruct.pt.x;
        int py = hookStruct.pt.y;

        uint color = GetPixelColor(px, py);

        _x[_count] = px;
        _y[_count] = py;
        _rgb[_count] = color;
        _count++;

        if (_count >= 2)
        {
          _done.Set();
        }
      }

      // Swallow the click so the app under the cursor doesn't receive it.
      return (IntPtr)1;
    }

    return CallNextHookEx(IntPtr.Zero, nCode, wParam, lParam);
  }

  private static IntPtr KeyboardHookCallback(int nCode, IntPtr wParam, IntPtr lParam)
  {
    if (nCode >= 0 && wParam == (IntPtr)WM_KEYDOWN)
    {
      KBDLLHOOKSTRUCT hookStruct = (KBDLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(KBDLLHOOKSTRUCT));
      if (hookStruct.vkCode == VK_ESCAPE)
      {
        _canceled = true;
        _done.Set();
      }
    }

    return CallNextHookEx(IntPtr.Zero, nCode, wParam, lParam);
  }

  private static uint GetPixelColor(int x, int y)
  {
    IntPtr hdc = GetDC(IntPtr.Zero);
    if (hdc == IntPtr.Zero)
    {
      return 0;
    }

    try
    {
      return GetPixel(hdc, x, y);
    }
    finally
    {
      ReleaseDC(IntPtr.Zero, hdc);
    }
  }

  private static string ToHex(uint colorref)
  {
    // COLORREF is 0x00bbggrr
    uint r = colorref & 0xFF;
    uint g = (colorref >> 8) & 0xFF;
    uint b = (colorref >> 16) & 0xFF;
    return String.Format("#{0:X2}{1:X2}{2:X2}", r, g, b);
  }

  private static string ToJson()
  {
    string fgHex = ToHex(_rgb[0]);
    string bgHex = ToHex(_rgb[1]);

    return String.Format(
      "{{\"foreground\":{{\"x\":{0},\"y\":{1},\"hex\":\"{2}\"}},\"background\":{{\"x\":{3},\"y\":{4},\"hex\":\"{5}\"}}}}",
      _x[0], _y[0], fgHex,
      _x[1], _y[1], bgHex
    );
  }

  private delegate IntPtr LowLevelMouseProc(int nCode, IntPtr wParam, IntPtr lParam);
  private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

  [StructLayout(LayoutKind.Sequential)]
  private struct POINT
  {
    public int x;
    public int y;
  }

  [StructLayout(LayoutKind.Sequential)]
  private struct MSLLHOOKSTRUCT
  {
    public POINT pt;
    public uint mouseData;
    public uint flags;
    public uint time;
    public IntPtr dwExtraInfo;
  }

  [StructLayout(LayoutKind.Sequential)]
  private struct KBDLLHOOKSTRUCT
  {
    public int vkCode;
    public int scanCode;
    public int flags;
    public int time;
    public IntPtr dwExtraInfo;
  }

  [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
  private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelMouseProc lpfn, IntPtr hMod, uint dwThreadId);

  [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
  private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

  [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
  [return: MarshalAs(UnmanagedType.Bool)]
  private static extern bool UnhookWindowsHookEx(IntPtr hhk);

  [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
  private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

  [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
  private static extern IntPtr GetModuleHandle(string lpModuleName);

  [DllImport("user32.dll")]
  private static extern IntPtr GetDC(IntPtr hWnd);

  [DllImport("user32.dll")]
  private static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

  [DllImport("gdi32.dll")]
  private static extern uint GetPixel(IntPtr hdc, int nXPos, int nYPos);
}
"@

Add-Type -TypeDefinition $source -Language CSharp

$exitCode = [PixelPicker]::Run($TimeoutMs)
exit $exitCode


