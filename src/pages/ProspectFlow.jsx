import Agenda from './agenda/Agenda';
import ProspectFlowComercial from './ProspectFlowComercial';

export default function ProspectFlow({view='contacts'}) {
  return view === 'agenda' ? <Agenda /> : <ProspectFlowComercial view={view} />;
}
