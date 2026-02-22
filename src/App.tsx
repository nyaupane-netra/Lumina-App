/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { 
  Camera, 
  History, 
  Info, 
  Play, 
  RotateCcw, 
  Sparkles, 
  Volume2, 
  ExternalLink,
  ChevronRight,
  Loader2,
  Key
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { 
  recognizeLandmark, 
  getLandmarkHistory, 
  generateNarration, 
  generateARVideo,
  type LandmarkInfo,
  type DetailedHistory
} from "./services/gemini";

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

type AppState = "IDLE" | "CAPTURING" | "ANALYZING" | "RESULT";

export default function App() {
  const [state, setState] = useState<AppState>("IDLE");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [landmark, setLandmark] = useState<LandmarkInfo | null>(null);
  const [history, setHistory] = useState<DetailedHistory | null>(null);
  const [narrationAudio, setNarrationAudio] = useState<string | null>(null);
  const [arVideo, setArVideo] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState<string>("");
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    if (window.aistudio) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(hasKey);
    }
  };

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const startCamera = async () => {
    setState("CAPTURING");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera. Please check permissions.");
      setState("IDLE");
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(video, 0, 0);
      
      const base64 = canvas.toDataURL("image/jpeg").split(",")[1];
      setCapturedImage(canvas.toDataURL("image/jpeg"));
      
      // Stop camera
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      
      processImage(base64);
    }
  };

  const processImage = async (base64: string) => {
    setState("ANALYZING");
    try {
      setLoadingStep("Recognizing landmark...");
      const info = await recognizeLandmark(base64);
      setLandmark(info);

      setLoadingStep("Fetching historical data...");
      const historyData = await getLandmarkHistory(info.name, info.location);
      setHistory(historyData);

      setLoadingStep("Generating narration...");
      const audioBase64 = await generateNarration(info.shortDescription + ". " + historyData.history.substring(0, 200));
      setNarrationAudio(`data:audio/mp3;base64,${audioBase64}`);

      setState("RESULT");
    } catch (err) {
      console.error("Processing error:", err);
      alert("Something went wrong during analysis.");
      setState("IDLE");
    }
  };

  const generateClip = async () => {
    if (!landmark || !capturedImage) return;
    
    if (!hasApiKey) {
      await handleOpenKeySelector();
    }

    setLoadingStep("Creating AR-style cinematic clip...");
    try {
      const videoUrl = await generateARVideo(landmark.name, capturedImage.split(",")[1]);
      setArVideo(videoUrl);
    } catch (err) {
      console.error("Video generation error:", err);
      alert("Failed to generate video clip.");
    }
  };

  const reset = () => {
    setState("IDLE");
    setCapturedImage(null);
    setLandmark(null);
    setHistory(null);
    setNarrationAudio(null);
    setArVideo(null);
    setLoadingStep("");
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      <div className="atmosphere" />
      
      {/* Header */}
      <header className="p-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-600/20">
            <Sparkles className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-serif tracking-tight">Lumina</h1>
            <p className="text-[10px] uppercase tracking-widest opacity-50 font-mono">Tourist Guide</p>
          </div>
        </div>
        
        {!hasApiKey && (
          <button 
            onClick={handleOpenKeySelector}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs font-mono hover:bg-white/10 transition-colors"
          >
            <Key size={14} />
            Connect Veo
          </button>
        )}
      </header>

      <main className="flex-1 flex flex-col p-6 relative z-10">
        <AnimatePresence mode="wait">
          {state === "IDLE" && (
            <motion.div 
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col items-center justify-center text-center space-y-8"
            >
              <div className="space-y-4">
                <h2 className="text-5xl md:text-7xl font-serif leading-tight">
                  Discover the <br />
                  <span className="italic text-orange-500">Unseen History</span>
                </h2>
                <p className="text-lg opacity-60 max-w-md mx-auto">
                  Point your camera at any landmark to unlock its stories, secrets, and cinematic past.
                </p>
              </div>

              <button 
                onClick={startCamera}
                className="group relative w-32 h-32 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
              >
                <div className="absolute inset-0 rounded-full border border-white/20 group-hover:border-orange-500/50 transition-colors" />
                <div className="absolute inset-2 rounded-full border border-white/10 group-hover:border-orange-500/30 transition-colors" />
                <div className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center shadow-2xl">
                  <Camera size={32} />
                </div>
              </button>
            </motion.div>
          )}

          {state === "CAPTURING" && (
            <motion.div 
              key="capturing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col relative rounded-3xl overflow-hidden glass border-white/10"
            >
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex flex-col justify-between p-8">
                <div className="flex justify-between items-start">
                  <div className="px-3 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-[10px] font-mono uppercase tracking-widest">
                    Live Feed
                  </div>
                  <button onClick={reset} className="p-2 rounded-full bg-black/50 backdrop-blur-md border border-white/10">
                    <RotateCcw size={18} />
                  </button>
                </div>
                
                {/* Viewfinder */}
                <div className="self-center w-64 h-64 border-2 border-white/20 rounded-3xl relative">
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-orange-500" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-orange-500" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-orange-500" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-orange-500" />
                </div>

                <div className="flex justify-center">
                  <button 
                    onClick={capturePhoto}
                    className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center p-1"
                  >
                    <div className="w-full h-full rounded-full bg-white hover:bg-orange-500 transition-colors" />
                  </button>
                </div>
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </motion.div>
          )}

          {state === "ANALYZING" && (
            <motion.div 
              key="analyzing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center space-y-8"
            >
              <div className="relative w-64 h-64 rounded-3xl overflow-hidden shadow-2xl">
                <img src={capturedImage!} className="w-full h-full object-cover grayscale opacity-50" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
                </div>
                <motion.div 
                  animate={{ top: ["0%", "100%", "0%"] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute left-0 right-0 h-1 bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.8)] z-20"
                />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-serif italic">Analyzing Landmark</h3>
                <p className="text-sm font-mono opacity-50 uppercase tracking-widest">{loadingStep}</p>
              </div>
            </motion.div>
          )}

          {state === "RESULT" && landmark && (
            <motion.div 
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 flex flex-col space-y-6 pb-12"
            >
              {/* Hero Section */}
              <div className="relative h-[40vh] rounded-3xl overflow-hidden shadow-2xl border border-white/10">
                {arVideo ? (
                  <video 
                    src={arVideo} 
                    autoPlay 
                    loop 
                    muted 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img src={capturedImage!} className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                
                <div className="absolute bottom-0 left-0 right-0 p-8 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-orange-600 text-[10px] font-mono uppercase tracking-wider">
                      Verified Landmark
                    </span>
                    <span className="text-[10px] font-mono opacity-70 uppercase tracking-wider">
                      {(landmark.confidence * 100).toFixed(0)}% Confidence
                    </span>
                  </div>
                  <h2 className="text-4xl md:text-6xl font-serif leading-tight">{landmark.name}</h2>
                  <p className="text-sm opacity-80 flex items-center gap-1 italic">
                    <Info size={14} className="text-orange-500" />
                    {landmark.location}
                  </p>
                </div>

                {!arVideo && (
                  <button 
                    onClick={generateClip}
                    disabled={loadingStep.includes("Creating")}
                    className="absolute top-6 right-6 glass p-4 rounded-2xl flex items-center gap-3 hover:bg-white/10 transition-colors disabled:opacity-50"
                  >
                    {loadingStep.includes("Creating") ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <Play size={20} className="fill-white" />
                    )}
                    <div className="text-left">
                      <p className="text-[10px] font-mono uppercase tracking-widest opacity-50">Generate</p>
                      <p className="text-xs font-bold">AR Cinematic Clip</p>
                    </div>
                  </button>
                )}
              </div>

              {/* Content Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* History & Narration */}
                <div className="md:col-span-2 space-y-6">
                  <div className="glass rounded-3xl p-8 space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-2xl font-serif flex items-center gap-3">
                        <History className="text-orange-500" />
                        Historical Context
                      </h3>
                      {narrationAudio && (
                        <button 
                          onClick={() => audioRef.current?.play()}
                          className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:bg-orange-500 hover:text-white transition-colors"
                        >
                          <Volume2 size={20} />
                        </button>
                      )}
                    </div>
                    
                    <div className="markdown-body">
                      <Markdown>{history?.history || landmark.shortDescription}</Markdown>
                    </div>

                    {history?.sources && history.sources.length > 0 && (
                      <div className="pt-6 border-t border-white/10">
                        <p className="text-[10px] font-mono uppercase tracking-widest opacity-50 mb-3">Sources & Further Reading</p>
                        <div className="flex flex-wrap gap-2">
                          {history.sources.map((source, i) => (
                            <a 
                              key={i} 
                              href={source.uri} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition-colors"
                            >
                              {source.title}
                              <ExternalLink size={12} className="opacity-50" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sidebar: Fun Facts */}
                <div className="space-y-6">
                  <div className="glass rounded-3xl p-8 space-y-6">
                    <h3 className="text-xl font-serif flex items-center gap-3">
                      <Sparkles className="text-orange-500" />
                      Did You Know?
                    </h3>
                    <div className="space-y-4">
                      {history?.funFacts.map((fact, i) => (
                        <div key={i} className="flex gap-3 items-start group">
                          <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0 group-hover:scale-150 transition-transform" />
                          <p className="text-sm opacity-80 leading-relaxed">{fact}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={reset}
                    className="w-full glass rounded-2xl p-4 flex items-center justify-center gap-2 hover:bg-white/10 transition-colors text-sm font-mono uppercase tracking-widest"
                  >
                    <RotateCcw size={16} />
                    New Discovery
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Audio Element */}
      <audio ref={audioRef} src={narrationAudio || ""} />

      {/* Footer / Status */}
      <footer className="p-6 border-t border-white/5 flex justify-between items-center z-10">
        <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-widest opacity-40">
          <span>AI Engine: Gemini 3.1 Pro</span>
          <span className="w-1 h-1 rounded-full bg-white/20" />
          <span>Search: Grounded</span>
        </div>
        <div className="text-[10px] font-mono opacity-40">
          &copy; 2026 LUMINA TOURIST
        </div>
      </footer>
    </div>
  );
}
