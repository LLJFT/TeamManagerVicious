import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeroVideoProps {
  className?: string;
}

export function HeroVideo({ className }: HeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const src = isMobile ? "/videos/explainer-9x16.mp4" : "/videos/explainer-16x9.mp4";
  const poster = isMobile ? "/videos/poster-9x16.png" : "/videos/poster-16x9.png";
  const aspect = isMobile ? "aspect-[9/16]" : "aspect-video";

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = !muted;
    v.muted = next;
    setMuted(next);
    if (!next) {
      v.play().catch(() => {});
    }
  };

  return (
    <div
      className={`relative w-full overflow-hidden rounded-md bg-[hsl(0_0%_6%)] ${aspect} ${className ?? ""}`}
      data-testid="hero-video-container"
    >
      <video
        ref={videoRef}
        key={src}
        src={src}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
        data-testid="video-explainer"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={toggleMute}
        className="absolute bottom-3 end-3 backdrop-blur-md bg-background/40 border-white/20 text-white"
        data-testid="button-toggle-mute"
        aria-label={muted ? "Unmute video" : "Mute video"}
      >
        {muted ? <VolumeX className="h-4 w-4 me-1.5" /> : <Volume2 className="h-4 w-4 me-1.5" />}
        {muted ? "Tap to unmute" : "Mute"}
      </Button>
    </div>
  );
}
