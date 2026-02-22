import { GoogleGenAI, Modality, Type, VideoGenerationReferenceType } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface LandmarkInfo {
  name: string;
  location: string;
  confidence: number;
  shortDescription: string;
}

export interface DetailedHistory {
  history: string;
  funFacts: string[];
  sources: { title: string; uri: string }[];
}

export const recognizeLandmark = async (base64Image: string): Promise<LandmarkInfo> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
          {
            text: "Identify the landmark in this photo. Return a JSON object with 'name', 'location', 'confidence' (0-1), and 'shortDescription'.",
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          location: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          shortDescription: { type: Type.STRING },
        },
        required: ["name", "location", "confidence", "shortDescription"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
};

export const getLandmarkHistory = async (landmarkName: string, location: string): Promise<DetailedHistory> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Provide a detailed history and fun facts about ${landmarkName} in ${location}. Use Google Search to ensure accuracy.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          history: { type: Type.STRING, description: "Detailed historical background in markdown format." },
          funFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["history", "funFacts"],
      },
    },
  });

  const history = JSON.parse(response.text || "{}");
  const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
    ?.map((chunk: any) => ({
      title: chunk.web?.title || "Source",
      uri: chunk.web?.uri || "",
    }))
    .filter((s: any) => s.uri) || [];

  return { ...history, sources };
};

export const generateNarration = async (text: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Narrate this like a professional tour guide: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: "Charon" },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return base64Audio || "";
};

export const generateARVideo = async (landmarkName: string, base64Image: string): Promise<string> => {
  const ai = getAI();
  let operation = await ai.models.generateVideos({
    model: "veo-3.1-fast-generate-preview",
    prompt: `A cinematic, historical reconstruction of ${landmarkName}. High quality, atmospheric, 4k.`,
    image: {
      imageBytes: base64Image,
      mimeType: "image/jpeg",
    },
    config: {
      numberOfVideos: 1,
      resolution: "720p",
      aspectRatio: "16:9",
    },
  });

  while (!operation.done) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("Video generation failed");

  const response = await fetch(downloadLink, {
    method: "GET",
    headers: {
      "x-goog-api-key": process.env.GEMINI_API_KEY || "",
    },
  });

  const blob = await response.blob();
  return URL.createObjectURL(blob);
};
