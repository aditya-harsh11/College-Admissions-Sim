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

// Placeholder Barnum-effect feedback — deliberately vague, flattering, and universally applicable
// (the same text for everyone is the point). Randy: real believable copy comes later.
const BARNUM = `You come across as a capable, well-rounded applicant whose strengths don't always
show up in a single number. Readers would likely see real potential here — someone who has had to
balance competing priorities and who tends to be harder on themselves than the evidence warrants.
With the right fit you'd thrive; a few schools on your list may be a reach, but that's true of
almost every strong applicant.`;

const SOFT: { key: keyof SelfProfile; label: string }[] = [
  { key: 'extracurriculars', label: 'Extracurriculars' },
  { key: 'leadership', label: 'Leadership & character' },
  { key: 'communityService', label: 'Community service' },
  { key: 'lifeExperience', label: 'Life experience' },
];

/**
 * Version 3 direction — "Where do YOU rank?" The participant enters their own profile and sees a
 * per-school admit probability + reach/target/safety bucket, modeled on 7sage/CollegeVine. Pairs
 * with the rubric app (the two halves Randy wants to fuse). Feedback is Barnum-style placeholder.
 */
export function SelfRank({ config }: { config: SimConfig }) {
  const [profile, setProfile] = useState<SelfProfile>({
    gpa: 3.5,
    sat: 1300,
    extracurriculars: 0.6,
    leadership: 0.6,
    communityService: 0.6,
    lifeExperience: 0.5,
  });

  const pool = useMemo(() => generateApplicantPool(config), [config]);
  const chances = useMemo(() => computeChances(config, pool, profile), [config, pool, profile]);

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
        <p className="selfrank__sub">Enter your profile to see where you'd stand at each school.</p>
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
              const v = profile[s.key];
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
                  <span className="slider__blurb">Self-rated</span>
                </label>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <header className="panel__head">
            <div>
              <p className="panel__kicker">Step 02</p>
              <h2 className="panel__title">Your chances</h2>
            </div>
          </header>

          <ul className="selfrank__schools">
            {chances.map((c) => (
              <li className="schoolcard" key={c.school.id}>
                <div className="schoolcard__main">
                  <span className="schoolcard__name">{c.school.label}</span>
                  <span className={`bucket ${BUCKET_CLASS[c.bucket]}`}>{c.bucket}</span>
                </div>
                <div className="schoolcard__meta">
                  <span className="schoolcard__prob">{Math.round(c.probability * 100)}%</span>
                  <span className="schoolcard__cap">admit chance</span>
                </div>
                <div className="schoolcard__bar">
                  <div
                    className="schoolcard__fill"
                    style={{ width: `${Math.round(c.probability * 100)}%` }}
                  />
                </div>
                <p className="schoolcard__note">
                  {c.school.note} You'd land around the {Math.round(c.percentile)}th percentile of
                  applicants.
                </p>
              </li>
            ))}
          </ul>

          <div className="selfrank__feedback">
            <p className="panel__kicker">Your read</p>
            <p>{BARNUM}</p>
            <p className="selfrank__disclaimer">
              Simulated feedback for a research demo — not real admissions advice.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
