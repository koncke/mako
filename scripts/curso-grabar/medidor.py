# Lee (sin tocar nada) el pico de audio de cada app y el de la salida general.
import site, sys, time
sys.path.insert(0, site.getusersitepackages())
from pycaw.pycaw import AudioUtilities, IAudioMeterInformation
from comtypes import CLSCTX_ALL
for _ in range(3):
    for s in AudioUtilities.GetAllSessions():
        try:
            m = s._ctl.QueryInterface(IAudioMeterInformation)
            print(s.Process.name() if s.Process else 'sistema', s.ProcessId, 'pico', round(m.GetPeakValue(), 4), 'mute', s.SimpleAudioVolume.GetMute(), 'vol', round(s.SimpleAudioVolume.GetMasterVolume(), 2))
        except Exception as e:
            print('err', e)
    print('--'); time.sleep(0.5)
