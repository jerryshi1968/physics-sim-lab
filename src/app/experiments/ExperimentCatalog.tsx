import { useEffect, useRef, useState } from 'react';
import { experimentChoices, schoolLabels, catalogDomainLabels } from '../../experiments/catalog.ts';
import type { SchoolStage, CatalogDomain, ExperimentChoice } from '../../experiments/catalog.ts';

export function ExperimentCatalog({ stage, initialDomain = 'mechanical', onChoose, onCancel }: {
  stage: SchoolStage; initialDomain?: CatalogDomain; onChoose: (choice: ExperimentChoice) => void; onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const domains = (['mechanical', 'electrical', 'optical', 'thermal'] as const).filter(domain => experimentChoices.some(choice => choice.stage === stage && choice.domain === domain));
  const [domain, setDomain] = useState<CatalogDomain>(domains.includes(initialDomain) ? initialDomain : domains[0]!);
  const [selected, setSelected] = useState('');
  const choices = experimentChoices.filter(choice => choice.stage === stage && choice.domain === domain);
  const chosen = choices.find(choice => choice.id === selected);
  useEffect(() => { dialog.current?.showModal(); }, []);
  function chooseDomain(next: CatalogDomain) { if (next !== domain) { setDomain(next); setSelected(''); } }
  return <dialog ref={dialog} className="experiment-catalog-dialog" aria-labelledby="catalog-title" onCancel={onCancel}>
    <h2 id="catalog-title">{schoolLabels[stage]}</h2>
    <div className="experiment-catalog-tabs" role="tablist" aria-label="实验学科">{domains.map((value, index) => <button key={value} role="tab" id={`catalog-tab-${value}`} aria-selected={domain === value} aria-controls="catalog-choices" tabIndex={domain === value ? 0 : -1}
      onClick={() => chooseDomain(value)} onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? domains.length - 1 : (index + (event.key === 'ArrowLeft' ? -1 : 1) + domains.length) % domains.length;
        chooseDomain(domains[next]!); document.getElementById(`catalog-tab-${domains[next]}`)?.focus();
      }}>{catalogDomainLabels[value]}</button>)}</div>
    <div className="experiment-catalog-list" role="tabpanel" id="catalog-choices" aria-labelledby={`catalog-tab-${domain}`}>
      {choices.map(choice => <label className={`experiment-catalog-choice${selected === choice.id ? ' is-selected' : ''}`} key={choice.id}>
        <input type="radio" name="experiment-catalog-choice" value={choice.id} aria-label={choice.title} checked={selected === choice.id} onChange={() => setSelected(choice.id)} />
        <span><strong>{choice.title}</strong><small>{choice.description}</small></span>
      </label>)}
    </div>
    <div className="experiment-catalog-actions"><button onClick={onCancel} autoFocus>取消</button><button className="primary-button" disabled={!chosen} onClick={() => { if (chosen) onChoose(chosen); }}>进入实验</button></div>
  </dialog>;
}
