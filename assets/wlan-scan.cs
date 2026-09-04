using System;
using System.Runtime.InteropServices;

class Program {
    [DllImport("wlanapi.dll", SetLastError = true)]
    public static extern uint WlanOpenHandle(uint dwClientVersion, IntPtr pReserved, out uint pdwNegotiatedVersion, out IntPtr phClientHandle);

    [DllImport("wlanapi.dll", SetLastError = true)]
    public static extern uint WlanCloseHandle(IntPtr hClientHandle, IntPtr pReserved);

    [DllImport("wlanapi.dll", SetLastError = true)]
    public static extern uint WlanEnumInterfaces(IntPtr hClientHandle, IntPtr pReserved, out IntPtr ppInterfaceList);

    [DllImport("wlanapi.dll", SetLastError = true)]
    public static extern uint WlanScan(IntPtr hClientHandle, ref Guid pInterfaceGuid, IntPtr pDot11Ssid, IntPtr pIeData, IntPtr pReserved);

    [DllImport("wlanapi.dll")]
    public static extern void WlanFreeMemory(IntPtr pMemory);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct WLAN_INTERFACE_INFO {
        public Guid InterfaceGuid;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
        public string strInterfaceDescription;
        public int isState;
    }

    static void Main() {
        uint negVersion;
        IntPtr hClient;
        if (WlanOpenHandle(2, IntPtr.Zero, out negVersion, out hClient) != 0) return;
        try {
            IntPtr pList;
            if (WlanEnumInterfaces(hClient, IntPtr.Zero, out pList) != 0) return;
            try {
                uint count = (uint)Marshal.ReadInt32(pList, 0);
                IntPtr pInfo = new IntPtr(pList.ToInt64() + 8);
                for (int i = 0; i < count; i++) {
                    WLAN_INTERFACE_INFO info = (WLAN_INTERFACE_INFO)Marshal.PtrToStructure(pInfo, typeof(WLAN_INTERFACE_INFO));
                    WlanScan(hClient, ref info.InterfaceGuid, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
                    pInfo = new IntPtr(pInfo.ToInt64() + Marshal.SizeOf(typeof(WLAN_INTERFACE_INFO)));
                }
            } finally {
                WlanFreeMemory(pList);
            }
        } finally {
            WlanCloseHandle(hClient, IntPtr.Zero);
        }
    }
}

