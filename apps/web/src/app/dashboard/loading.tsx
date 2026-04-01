import Image from 'next/image';

export default function DashboardLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-3xl dark:bg-amber-300/15" />
        <Image
          src="/logo.svg"
          alt="Truly Imagined"
          width={360}
          height={112}
          priority
          className="relative h-auto w-56 sm:w-72 md:w-80 animate-pulse brightness-90 dark:brightness-110"
        />
      </div>
    </div>
  );
}
