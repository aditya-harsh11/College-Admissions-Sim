import { useYearScrubber } from '../hooks/useYearScrubber';
import { useScrollLock } from '../hooks/useScrollLock';
import { PROCESS_STEPS, type DemographicDataset } from './demographics';
import { YearStepper } from './YearStepper';

/**
 * The control stimulus: how the admissions PROCESS changed over the same span. It deliberately
 * COPIES the layout of the demographic visual (07-03 item 6 — design the harder condition, make
 * the control mirror it): same head, same big year band moved down, same year stepper with dwell
 * logging. Only the content differs (process, not who attends), which is the point — it isolates
 * the demographic reveal. `onExplored` fires once every year has been viewed.
 *
 * Reuses the shift dataset's YEAR axis so the two conditions scrub through the same timeline.
 */
export function ProcessTimeline({
  dataset,
  onExplored,
  scrollLock = false,
}: {
  dataset: DemographicDataset;
  onExplored?: () => void;
  /** Demo toggle: lock the page on the widget so scrolling steps the year until all are seen. */
  scrollLock?: boolean;
}) {
  const { years } = dataset;
  const scrub = useYearScrubber(years, 'process', onExplored);
  const yi = scrub.index;
  // Map each snapshot year onto a process milestone (four of each).
  const step = PROCESS_STEPS[Math.min(yi, PROCESS_STEPS.length - 1)];

  const lockRef = useScrollLock(scrollLock, scrub, years.length);

  return (
    <div className={`shift ${scrollLock && !scrub.allSeen ? 'shift--locked' : ''}`} ref={lockRef}>
      <div className="shift__head">
        <p className="panel__kicker">United States</p>
        <h3 className="shift__title">
          The admissions process, {years[0]}–{years[years.length - 1]}
        </h3>
      </div>

      {/* The process snapshot for the selected year (mirrors the demographic bar's slot). */}
      <div className="process__card" key={yi}>
        {step.head && <h4 className="process__head">{step.head}</h4>}
        <p className="process__body">{step.body}</p>
      </div>

      {/* Same big, moved-down year band as the demographic condition (item 4 / item 6). */}
      <div className="shift__yearband">
        <span className="shift__yearbig">{years[yi]}</span>
        <span className="shift__yearcap">
          step {yi + 1} of {years.length}
        </span>
      </div>

      <YearStepper
        years={years}
        index={scrub.index}
        seen={scrub.seen}
        onSetYear={scrub.setYear}
      />

      {scrub.allSeen && (
        <p className="shift__summary">
          Over these years, applying went from a mostly local, paper process to a high-volume,
          technology-driven one.
        </p>
      )}

      {scrollLock && !scrub.allSeen && (
        <p className="shift__lockhint">Scroll to move through the years — the page unlocks once you’ve seen them all.</p>
      )}

      <p className="shift__source">A general timeline of U.S. college admissions.</p>
    </div>
  );
}
