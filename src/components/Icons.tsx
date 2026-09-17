interface IconProps {
  size?: number
  className?: string
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export function TshirtIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M8.5 3.5 5 5.2 2.8 9.6l3 1.3V20.5h12.4V10.9l3-1.3L19 5.2l-3.5-1.7" />
      <path d="M8.5 3.5c0 1.9 1.6 3 3.5 3s3.5-1.1 3.5-3" />
    </svg>
  )
}

export function HoodieIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M8.6 4 5 5.6 2.8 10l3 1.2v9.3h12.4v-9.3l3-1.2L19 5.6 15.4 4" />
      <path d="M8.6 4c.6 2 1.8 3 3.4 3s2.8-1 3.4-3" />
      <path d="M9.4 13.8h5.2v3.4H9.4z" />
      <path d="M11 7v4M13 7v4" />
    </svg>
  )
}

export function CapIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4.4 14.6a7.6 7.6 0 0 1 15.2 0" />
      <path d="M3.4 14.6h16.3c1.6 0 2.9 1.1 2.9 2.4 0 .6-.5 1-1.2 1H3.4a1.7 1.7 0 0 1 0-3.4Z" />
      <path d="M12 7v7.6" />
      <circle cx="12" cy="6.6" r="1" />
    </svg>
  )
}

export function SheetsIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="5" width="11" height="14" rx="1.4" transform="rotate(-7 8.5 12)" />
      <rect x="10.5" y="5.6" width="10.5" height="13.6" rx="1.4" transform="rotate(6 15.7 12.4)" />
      <path d="M13.5 10.5h4.2M13.5 13.4h4.2" />
    </svg>
  )
}

export function PosterIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3.6 4.6h16.8" />
      <path d="M12 2.4v2.2" />
      <rect x="5.2" y="4.6" width="13.6" height="16.8" rx="1" />
      <path d="M7.8 16.6l2.9-3.6 2.2 2.6 1.9-2.2 2.3 3.2" />
      <circle cx="9.4" cy="9.4" r="1.2" />
    </svg>
  )
}

export function BrochureIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3 7.4 8.4 5v14L3 21.4z" />
      <path d="M8.4 5 15 7.4v14L8.4 19z" />
      <path d="M15 7.4 21 5v14l-6 2.4z" />
    </svg>
  )
}

export function BookIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M5.2 4.2h11.6A2.2 2.2 0 0 1 19 6.4v13.4H7.4A2.2 2.2 0 0 1 5.2 17.6z" />
      <path d="M5.2 17.6A2.2 2.2 0 0 1 7.4 15.4H19" />
      <path d="M9 4.2v11.2" />
    </svg>
  )
}

export function UploadIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 16V4.8" />
      <path d="m7.6 9.2 4.4-4.4 4.4 4.4" />
      <path d="M4.5 15.5v2.8a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2.8" />
    </svg>
  )
}

export function DownloadIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 4.5v11.2" />
      <path d="m7.6 11.3 4.4 4.4 4.4-4.4" />
      <path d="M4.5 15.5v2.8a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2.8" />
    </svg>
  )
}

export function TrashIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4.6 6.6h14.8" />
      <path d="M9.4 6.6V4.8h5.2v1.8" />
      <path d="M6.6 6.6 7.4 20h9.2l.8-13.4" />
      <path d="M10.4 10v6M13.6 10v6" />
    </svg>
  )
}

export function RotateIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20.2 4.4v4.2H16" />
    </svg>
  )
}

export function ShadowIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="10.5" cy="9.5" r="5.2" />
      <ellipse cx="13.5" cy="18.4" rx="7" ry="2.2" />
    </svg>
  )
}

export function GridIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3.6" y="3.6" width="16.8" height="16.8" rx="1.6" />
      <path d="M12 3.6v16.8M3.6 12h16.8" />
    </svg>
  )
}

export function WarningIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 4.6 2.8 20h18.4z" />
      <path d="M12 10v4.2" />
      <circle cx="12" cy="17.2" r=".6" fill="currentColor" />
    </svg>
  )
}

export function CheckIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  )
}

export function SparkIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 3.4 13.9 9l5.6 1.9-5.6 1.9L12 18.4 10.1 12.8 4.5 10.9 10.1 9z" />
      <path d="M18.6 3.2v2.6M19.9 4.5h-2.6" />
    </svg>
  )
}

export function CursorIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M5.6 4.2 19 11.4l-5.7 1.6-2.2 5.5z" />
    </svg>
  )
}

export function LayersIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="m12 3.6 8.4 4.2L12 12 3.6 7.8z" />
      <path d="m3.6 12.4 8.4 4.2 8.4-4.2" />
      <path d="m3.6 16.6 8.4 4.2 8.4-4.2" />
    </svg>
  )
}

export function FitIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4.2 8.6V4.4h4.2M15.6 4.4h4.2v4.2M19.8 15.4v4.2h-4.2M8.4 19.6H4.2v-4.2" />
    </svg>
  )
}

export function CenterIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="7.4" y="7.4" width="9.2" height="9.2" rx="1.2" />
      <path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6" />
    </svg>
  )
}

export function PipetteIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="m15.6 5.2 3.2 3.2" />
      <path d="M17.2 3.6a2.2 2.2 0 0 1 3.2 3.2l-1.7 1.7-3.2-3.2z" />
      <path d="m14.7 6.1-8.6 8.6-1.5 5 5-1.5 8.6-8.6" />
    </svg>
  )
}

export function BackgroundIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3.6" y="3.6" width="16.8" height="16.8" rx="2" />
      <path d="m4.4 15.4 4.2-4.2 3.4 3.4 3-3 4.6 4.6" />
      <circle cx="9" cy="8.6" r="1.3" />
    </svg>
  )
}

export function LaptopIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M6.4 6.2h11.2a1 1 0 0 1 1 1v8.1H5.4V7.2a1 1 0 0 1 1-1z" />
      <path d="M3.2 15.3h17.6l-1.1 2.1a1 1 0 0 1-.9.5H5.2a1 1 0 0 1-.9-.5z" />
      <path d="M10.6 6.2h2.8" />
    </svg>
  )
}

export const MOCKUP_ICONS: Record<string, (p: IconProps) => JSX.Element> = {
  tshirt: TshirtIcon,
  hoodie: HoodieIcon,
  cap: CapIcon,
  sheets: SheetsIcon,
  poster: PosterIcon,
  brochure: BrochureIcon,
  book: BookIcon,
  laptop: LaptopIcon,
}

export function MockupIcon({ name, size = 24 }: IconProps & { name: string }) {
  const Cmp = MOCKUP_ICONS[name] ?? SheetsIcon
  return <Cmp size={size} />
}
