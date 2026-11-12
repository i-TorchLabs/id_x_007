export default function LoadingDots() {
  return (
    <span className="inline-flex gap-1" aria-label="Loading">
      <span className="animate-bounce">.</span>
      <span className="animate-bounce [animation-delay:0.1s]">.</span>
      <span className="animate-bounce [animation-delay:0.2s]">.</span>
    </span>
  );
}
