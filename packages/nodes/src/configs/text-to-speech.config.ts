import { z } from "zod";

export const TTS_NODE_MODELS = [
    "gemini-2.5-flash-preview-tts",
    "gemini-2.5-pro-preview-tts",
] as const;

export const TTS_VOICE_NAMES = [
    "Zephyr",
    "Puck",
    "Charon",
    "Kore",
    "Fenrir",
    "Leda",
    "Orus",
    "Aoede",
    "Callirrhoe",
    "Autonoe",
    "Enceladus",
    "Iapetus",
    "Umbriel",
    "Algieba",
    "Despina",
    "Erinome",
    "Algenib",
    "Rasalgethi",
    "Laomedeia",
    "Achernar",
    "Alnilam",
    "Schedar",
    "Gacrux",
    "Pulcherrima",
    "Achird",
    "Zubenelgenubi",
    "Vindemiatrix",
    "Sadachbia",
    "Sadaltager",
    "Sulafat",
] as const;

export const TTS_LANGUAGES = [
    "ar-EG",
    "en-US",
    "en-IN",
    "fr-FR",
    "de-DE",
    "es-US",
    "hi-IN",
    "id-ID",
    "it-IT",
    "ja-JP",
    "ko-KR",
    "pt-BR",
    "ru-RU",
    "nl-NL",
    "pl-PL",
    "th-TH",
    "tr-TR",
    "vi-VN",
    "ro-RO",
    "uk-UA",
    "bn-BD",
    "mr-IN",
    "ta-IN",
    "te-IN",
] as const;

export const TextToSpeechNodeConfigSchema = z
    .object({
        model: z.string().optional(),
        voiceName: z.enum(TTS_VOICE_NAMES).optional(),
        languageCode: z.enum(TTS_LANGUAGES).optional(),
        speakerConfig: z.array(z.object({
            speaker: z.string(),
            voiceName: z.enum(TTS_VOICE_NAMES),
        })).optional(),
    })
    .strict();


export type TextToSpeechNodeConfig = z.infer<typeof TextToSpeechNodeConfigSchema>;
