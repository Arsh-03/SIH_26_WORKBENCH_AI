import React from 'react'

/**
 * FilmGrain
 * Reusable analog darkroom film-grain noise overlay.
 * Fixed full screen, ~3.5% opacity, mix-blend-mode: screen, pointer-events-none.
 */
export const FilmGrain: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[9999] h-full w-full select-none overflow-hidden"
      style={{
        opacity: 0.035,
        mixBlendMode: 'screen',
      }}
    >
      <svg
        className="h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <filter id="darkroom-film-grain" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="4"
            stitchTiles="stitch"
            result="noise"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#darkroom-film-grain)" />
      </svg>
    </div>
  )
}

export default FilmGrain
