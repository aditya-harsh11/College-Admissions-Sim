import { Sandbox } from './Sandbox';
import { StudyFlow } from './study/StudyFlow';
import { ShiftStudy } from './study/ShiftStudy';
import { DEFAULT_CONFIG } from './sim/config';

const config = DEFAULT_CONFIG;

/**
 * One switch, driven by `config.ui.flow` — a "version" is a config, not a fork:
 *   `single` → single-page sandbox (v1)   ·   `study` → pre/post study flow (v4)
 *   `shift`  → shifting-demographics study (v6)
 */
export default function App() {
  if (config.ui.flow === 'shift') return <ShiftStudy config={config} />;
  if (config.ui.flow === 'study') return <StudyFlow config={config} />;
  return <Sandbox config={config} />;
}
