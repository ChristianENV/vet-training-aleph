import { ImageResponse } from "next/og";

import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/site-metadata";

/** Recommended OG dimensions for WhatsApp, Facebook, X, etc. */
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

/**
 * Generated 1200×630 preview — no tiny logo-only asset; readable at chat preview sizes.
 * Brand colors align with globals.css (navy / cyan / canvas).
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 72,
          backgroundColor: "#f7fafc",
          borderBottom: "8px solid #2aa6d9",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            maxWidth: 960,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "baseline",
              fontSize: 64,
              fontWeight: 700,
              color: "#1d3154",
              letterSpacing: -1,
              lineHeight: 1.1,
            }}
          >
            <span>Aleph </span>
            <span style={{ color: "#2aa6d9" }}>Vet</span>
            <span> Staff</span>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 32,
              fontWeight: 600,
              color: "#304c7b",
              letterSpacing: -0.5,
              marginTop: 20,
            }}
          >
            {SITE_TAGLINE}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              fontWeight: 400,
              color: "#536174",
              lineHeight: 1.45,
              maxWidth: 900,
              marginTop: 20,
            }}
          >
            {SITE_DESCRIPTION}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
