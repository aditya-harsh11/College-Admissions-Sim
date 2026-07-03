import { Sandbox } from './Sandbox';
import { StudyFlow } from './study/StudyFlow';
import { ShiftStudy } from './study/ShiftStudy';
import { ShiftStudyOriginal } from './study/v6original/ShiftStudyOriginal';
import { DEFAULT_CONFIG } from './sim/config';

const config = DEFAULT_CONFIG;

/**
 * One switch, driven by `config.ui.flow` — a "version" is a config, not a fork:
 *   `single` → single-page sandbox (v1)   ·   `study` → pre/post study flow (v4)
 *   `shift`  → shifting-demographics study (v6)
 *
 * v6 has two builds you can compare (for the lab, not participants): `?build=original` renders the
 * pre-redesign v6 (src/study/v6original/), anything else renders the current "Updated" news-article
 * build. A participant just gets `?build=updated` (the default) with random condition assignment.
 */
export default function App() {
  if (config.ui.flow === 'shift') {
    const build = new URLSearchParams(window.location.search).get('build');
    return build === 'original' ? (
      <ShiftStudyOriginal config={config} />
    ) : (
      <ShiftStudy config={config} />
    );
  }
  if (config.ui.flow === 'study') return <StudyFlow config={config} />;
  return <Sandbox config={config} />;
}
