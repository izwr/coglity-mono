export interface LanguageConfig {
  code: string;
  label: string;
  sttLanguage: string;
  ttsVoice: string;
}

export interface EnvironmentConfig {
  id: string;
  label: string;
  defaultSnrDb: number;
}

export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  { code: "en-US", label: "English", sttLanguage: "en-US", ttsVoice: "en-US-AvaMultilingualNeural" },
  { code: "hi-IN", label: "Hindi", sttLanguage: "hi-IN", ttsVoice: "hi-IN-SwaraNeural" },
  { code: "bn-IN", label: "Bengali", sttLanguage: "bn-IN", ttsVoice: "bn-IN-TanishaaNeural" },
  { code: "te-IN", label: "Telugu", sttLanguage: "te-IN", ttsVoice: "te-IN-ShrutiNeural" },
  { code: "mr-IN", label: "Marathi", sttLanguage: "mr-IN", ttsVoice: "mr-IN-AarohiNeural" },
  { code: "ta-IN", label: "Tamil", sttLanguage: "ta-IN", ttsVoice: "ta-IN-PallaviNeural" },
  { code: "gu-IN", label: "Gujarati", sttLanguage: "gu-IN", ttsVoice: "gu-IN-DhwaniNeural" },
  { code: "kn-IN", label: "Kannada", sttLanguage: "kn-IN", ttsVoice: "kn-IN-SapnaNeural" },
  { code: "ml-IN", label: "Malayalam", sttLanguage: "ml-IN", ttsVoice: "ml-IN-SobhanaNeural" },
  { code: "or-IN", label: "Odia", sttLanguage: "or-IN", ttsVoice: "or-IN-SubhasiniNeural" },
  { code: "pa-IN", label: "Punjabi", sttLanguage: "pa-IN", ttsVoice: "pa-IN-GurpreetNeural" },
];

export const SUPPORTED_ENVIRONMENTS: EnvironmentConfig[] = [
  { id: "quiet", label: "Quiet", defaultSnrDb: 100 },
  { id: "cafe", label: "Cafe", defaultSnrDb: 15 },
  { id: "train", label: "Train", defaultSnrDb: 10 },
  { id: "traffic", label: "Traffic", defaultSnrDb: 12 },
  { id: "office", label: "Office", defaultSnrDb: 25 },
  { id: "crowd", label: "Crowd", defaultSnrDb: 10 },
  { id: "construction", label: "Construction", defaultSnrDb: 8 },
  { id: "rain", label: "Rain", defaultSnrDb: 18 },
  { id: "airport", label: "Airport", defaultSnrDb: 12 },
  { id: "wind", label: "Wind", defaultSnrDb: 15 },
];

export function getLanguageConfig(code: string): LanguageConfig | undefined {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code);
}

export function getEnvironmentConfig(id: string): EnvironmentConfig | undefined {
  return SUPPORTED_ENVIRONMENTS.find((e) => e.id === id);
}
