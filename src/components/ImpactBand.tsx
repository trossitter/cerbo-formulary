"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

const metrics = [
  {
    value: 50,
    label: "reduction in patient admin time",
    accent: "var(--cerbo-blue)",
  },
  {
    value: 45,
    label: "reduction in ordering prescriptions and supplements",
    accent: "var(--cerbo-pink)",
  },
  {
    value: 75,
    label: "reduction in patient inquiries",
    accent: "var(--cerbo-teal)",
  },
];

export function ImpactBand() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      const reducedFrame = requestAnimationFrame(() => setProgress(1));
      return () => cancelAnimationFrame(reducedFrame);
    }

    let frame = 0;
    const duration = 1300;
    const start = performance.now();

    function animate(now: number) {
      const elapsed = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      setProgress(eased);
      if (elapsed < 1) frame = requestAnimationFrame(animate);
    }

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <section className="impact-band">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_1.7fr] lg:items-center">
        <div className="space-y-2">
          <p className="section-label">Saving you time</p>
          <h2 className="serif-heading text-3xl font-bold leading-tight">
            Faster ordering, cleaner billing, less admin drag.
          </h2>
          <p className="page-subtitle">
            Cerbo frames operational wins in time saved. This formulary slice makes
            that promise concrete around supplement orders, payment, inventory, and
            every cent in the ledger.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="impact-metric"
              style={{ "--metric-accent": metric.accent } as CSSProperties}
            >
              <div className="impact-number">
                {Math.round(metric.value * progress)}%
              </div>
              <p>{metric.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
