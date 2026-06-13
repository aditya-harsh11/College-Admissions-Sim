import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { computeChances, type Bucket, type SelfProfile } from '../sim/chances';
import { generateApplicantPool } from '../sim/generator';
import { logEvent } from '../lib/logger';
import type { SimConfig } from '../sim/types';

const BUCKET_CLASS: Record<Bucket, string> = {
  Safety: 'bucket--safety',
  Target: 'bucket--target',
  Reach: 'bucket--reach',
  'Hard reach': 'bucket--hard',
};

// Placeholder for the eventual Barnum-effect feedback (same vague-but-believable copy for everyone).
const BARNUM = 'Placeholder feedback text. The real wording goes here later.';

const SOFT: { key: keyof SelfProfile; label: string }[] = [
  { key: 'extracurriculars', label: 'Extracurriculars' },
  { key: 'leadership', label: 'Leadership & character' },
  { key: 'communityService', label: 'Community service' },
  { key: 'lifeExperience', label: 'Life experience' },
];

/**
 * "Where do you rank?" — modeled on the 7sage predictor: enter your profile, get a ranked TABLE of
 * schools with your admit chance + a reach/target/safety verdict. Pairs with the rubric app (the two
 * halves Randy wants to fuse). Chances are computed against the simulated pool — not real.
 */
export function SelfRank({ config }: { config: SimConfig }) {
  const [profile, setProfile] = useState<SelfProfile>({
    gpa: 3.5,
    sat: 1300,
    extracurriculars: 0.6,
    leadership: 0.6,
    communityService: 0.6,
    lifeExperience: 0.5,
    urm: false,
  });

  const pool = useMemo(() => generateApplicantPool(config), [config]);
  const chances = useMemo(() => computeChances(config, pool, profile), [config, pool, profile]);
  // Sort like a real predictor: best odds first.
  const ranked = useMemo(() => [...chances].sort((a, b) => b.probability - a.probability), [chances]);

  useEffect(() => {
    logEvent('session_start', { flow: 'selfrank' });
  }, []);

  const update = (patch: Partial<SelfProfile>) =>
    setProfile((prev) => {
      logEvent('field_change', patch as Record<string, unknown>);
      return { ...prev, ...patch };
    });

  return (
    <div className="app selfrank">
      <header className="selfrank__head">
        <h1 className="masthead__title">
          Where do <em>you</em> rank?
        </h1>
        <p className="selfrank__sub">Enter your profile to see your shot at each school.</p>
      </header>

      <main className="lab">
        <section className="panel">
          <header className="panel__head">
            <div>
              <p className="panel__kicker">Step 01</p>
              <h2 className="panel__title">Your profile</h2>
            </div>
          </header>

          <div className="selfrank__inputs">
            <label className="slider">
              <div className="slider__top">
                <span className="slider__label">GPA</span>
                <span className="slider__chip">
                  <strong>{profile.gpa.toFixed(1)}</strong>
                  <em>/ 4.0</em>
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={4}
                step={0.1}
                value={profile.gpa}
                style={{ '--fill': `${(profile.gpa / 4) * 100}%` } as CSSProperties}
                onChange={(e) => update({ gpa: Number(e.target.value) })}
                aria-label="GPA"
              />
            </label>

            <label className="slider">
              <div className="slider__top">
                <span className="slider__label">SAT</span>
                <span className="slider__chip">
                  <strong>{profile.sat}</strong>
                  <em>/ 1600</em>
                </span>
              </div>
              <input
                type="range"
                min={400}
                max={1600}
                step={10}
                value={profile.sat}
                style={{ '--fill': `${((profile.sat - 400) / 1200) * 100}%` } as CSSProperties}
                onChange={(e) => update({ sat: Number(e.target.value) })}
                aria-label="SAT"
              />
            </label>

            {SOFT.map((s) => {
              const v = profile[s.key] as number;
              return (
                <label className="slider" key={s.key}>
                  <div className="slider__top">
                    <span className="slider__label">{s.label}</span>
                    <span className="slider__chip">
                      <strong>{Math.round(v * 100)}</strong>
                      <em>/ 100</em>
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(v * 100)}
                    style={{ '--fill': `${v * 100}%` } as CSSProperties}
                    onChange={(e) =>
                      update({ [s.key]: Number(e.target.value) / 100 } as Partial<SelfProfile>)
                    }
                    aria-label={s.label}
                  />
                </label>
              );
            })}

            <label className="selfrank__check">
              <input
                type="checkbox"
                checked={!!profile.urm}
                onChange={(e) => update({ urm: e.target.checked })}
              />
              <span>First-generation / underrepresented background</span>
            </label>
          </div>
        </section>

        <section className="panel">
          <header className="panel__head">
            <div>
              <p className="panel__kicker">Step 02</p>
              <h2 className="panel__title">Where you'd stand</h2>
            </div>
          </header>

          <table className="ranktable">
            <thead>
              <tr>
                <th>School</th>
                <th className="ranktable__num">Admit rate</th>
                <th>Your chance</th>
                <th className="ranktable__num">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((c) => {
                const pct = Math.round(c.probability * 100);
                return (
                  <tr key={c.school.id}>
                    <td className="ranktable__school">
                      {c.school.label}
                      {c.school.testBlind && <span className="ranktable__tag">test-blind</span>}
                    </td>
                    <td className="ranktable__num ranktable__rate">
                      {Math.round(c.school.admitRate * 100)}%
                    </td>
                    <td>
                      <div className="ranktable__chance">
                        <span className="ranktable__bar">
                          <span style={{ width: `${pct}%` }} />
                        </span>
                        <span className="ranktable__pct">{pct}%</span>
                      </div>
                    </td>
                    <td className="ranktable__num">
                      <span className={`bucket ${BUCKET_CLASS[c.bucket]}`}>{c.bucket}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="selfrank__feedback">
            <p className="panel__kicker">Your read</p>
            <p>{BARNUM}</p>
          </div>
        </section>
      </main>
    </div>
  );
}
