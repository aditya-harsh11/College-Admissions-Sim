import { Sandbox } from './Sandbox';
import { StudyFlow } from './study/StudyFlow';
import { SelfRank } from './study/SelfRank';
import { DEFAULT_CONFIG } from './sim/config';

const config = DEFAULT_CONFIG;

/**
 * One switch over `config.ui.flow`, so a "version" is a config, not a fork:
 *   single   → the single-page sandbox (Version 1)
 *   study    → the multi-step pre/post study instrument (Version 2)
 *   selfrank → the "where do you rank?" self-ranking tool (Version 3 direction)
 */
export default function App() {
  if (config.ui.flow === 'study') return <StudyFlow config={config} />;
  if (config.ui.flow === 'selfrank') return <SelfRank config={config} />;
  return <Sandbox config={config} />;
}
