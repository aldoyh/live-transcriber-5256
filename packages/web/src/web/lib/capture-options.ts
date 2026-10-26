// Browser hints, not a permission bypass. The user still selects a tab in Chrome.
export const tabCaptureOptions: DisplayMediaStreamOptions & {
  selfBrowserSurface: "exclude";
  systemAudio: "exclude";
  monitorTypeSurfaces: "exclude";
  surfaceSwitching: "include";
} = {
  video: { displaySurface: "browser" },
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    suppressLocalAudioPlayback: false,
  } as MediaTrackConstraints & { suppressLocalAudioPlayback: boolean },
  selfBrowserSurface: "exclude",
  systemAudio: "exclude",
  monitorTypeSurfaces: "exclude",
  surfaceSwitching: "include",
};
