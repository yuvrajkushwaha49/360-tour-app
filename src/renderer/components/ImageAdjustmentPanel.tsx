import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  RotateCw,
  Sliders,
  Sun,
  Contrast as ContrastIcon,
  Eye,
  Palette,
  Sparkles,
  Copy,
  Check,
  ClipboardCheck,
  Globe,
  CheckSquare,
  Square,
  X,
  RotateCcw as ResetIcon,
  Thermometer,
  Layers,
  Image as ImageIcon
} from 'lucide-react';
import {
  ImageAdjustments,
  DEFAULT_ADJUSTMENTS,
  PRESETS
} from '../utils/imageAdjustmentEngine';

interface LocationItem {
  id: string;
  name: string;
  stitchedPanoPath?: string | null;
  directions?: Record<string, any[]>;
}

interface ImageAdjustmentPanelProps {
  adjustments: ImageAdjustments;
  onChange: (newAdj: ImageAdjustments) => void;
  locations: LocationItem[];
  activeLocationId: string;
  onApplyToAll: (adj: ImageAdjustments) => void;
  onApplyToSelected: (targetIds: string[], adj: ImageAdjustments) => void;
  onAddLog?: (msg: string) => void;
}

export const ImageAdjustmentPanel: React.FC<ImageAdjustmentPanelProps> = ({
  adjustments,
  onChange,
  locations,
  activeLocationId,
  onApplyToAll,
  onApplyToSelected,
  onAddLog
}) => {
  const [copiedAdj, setCopiedAdj] = useState<ImageAdjustments | null>(null);
  const [copiedToast, setCopiedToast] = useState<boolean>(false);
  const [appliedToast, setAppliedToast] = useState<string | null>(null);
  const [showSelectModal, setShowSelectModal] = useState<boolean>(false);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);

  const [undoStack, setUndoStack] = useState<ImageAdjustments[]>([]);
  const [redoStack, setRedoStack] = useState<ImageAdjustments[]>([]);

  const activeRoom = locations.find((l) => l.id === activeLocationId);

  useEffect(() => {
    setSelectedLocationIds(locations.map((l) => l.id));
  }, [locations]);

  const pushHistory = (nextAdj: ImageAdjustments) => {
    setUndoStack((prev) => [...prev, adjustments]);
    setRedoStack([]);
    onChange(nextAdj);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, s.length - 1));
    setRedoStack((s) => [...s, adjustments]);
    onChange(prev);
    if (onAddLog) onAddLog('Undo image adjustment');
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((s) => s.slice(0, s.length - 1));
    setUndoStack((s) => [...s, adjustments]);
    onChange(next);
    if (onAddLog) onAddLog('Redo image adjustment');
  };

  const updateSingleParam = (key: keyof ImageAdjustments, value: number) => {
    const next: ImageAdjustments = {
      ...adjustments,
      [key]: value,
      preset: 'Custom'
    };
    pushHistory(next);
  };

  const resetSingleParam = (key: keyof ImageAdjustments) => {
    const defaultVal = DEFAULT_ADJUSTMENTS[key] || 0;
    updateSingleParam(key, defaultVal as number);
  };

  const handleSelectPreset = (presetName: string) => {
    const presetValues = PRESETS[presetName] || DEFAULT_ADJUSTMENTS;
    const next: ImageAdjustments = {
      ...presetValues,
      preset: presetName
    };
    pushHistory(next);
    if (onAddLog) onAddLog(`Applied preset: ${presetName}`);
  };

  const handleResetAll = () => {
    pushHistory({ ...DEFAULT_ADJUSTMENTS });
    if (onAddLog) onAddLog('Reset all image adjustments to Original');
  };

  const handleCopyAdjustments = () => {
    setCopiedAdj({ ...adjustments });
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2000);
    if (onAddLog) onAddLog('Copied image adjustment settings');
  };

  const handlePasteAdjustments = () => {
    if (!copiedAdj) return;
    pushHistory({ ...copiedAdj });
    if (onAddLog) onAddLog('Pasted copied image adjustment settings');
  };

  const handleConfirmApplyToAll = () => {
    if (locations.length === 0) return;
    onApplyToAll(adjustments);
    setAppliedToast(`✅ Applied & saved to all ${locations.length} rooms!`);
    setTimeout(() => setAppliedToast(null), 3500);
    if (onAddLog) onAddLog(`Applied image adjustments to all ${locations.length} rooms`);
  };

  const handleConfirmApplyToSelected = () => {
    if (selectedLocationIds.length === 0) return;
    onApplyToSelected(selectedLocationIds, adjustments);
    setShowSelectModal(false);
    setAppliedToast(`✅ Applied & saved to ${selectedLocationIds.length} selected rooms!`);
    setTimeout(() => setAppliedToast(null), 3500);
    if (onAddLog) onAddLog(`Applied image adjustments to ${selectedLocationIds.length} selected rooms`);
  };

  const renderSlider = (
    label: string,
    key: keyof ImageAdjustments,
    min: number,
    max: number,
    unit: string = '',
    icon?: React.ReactNode,
    subtext?: string
  ) => {
    const val = (adjustments[key] as number) || 0;
    const isDefault = val === (DEFAULT_ADJUSTMENTS[key] || 0);

    return (
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {icon} {label}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: isDefault ? '#94a3b8' : '#818cf8',
                background: isDefault ? 'rgba(255,255,255,0.06)' : 'rgba(99,102,241,0.2)',
                padding: '1px 6px',
                borderRadius: '4px',
                minWidth: '36px',
                textAlign: 'center'
              }}
            >
              {val > 0 ? `+${val}` : val}
              {unit}
            </span>
            {!isDefault && (
              <button
                onClick={() => resetSingleParam(key)}
                title={`Reset ${label}`}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <ResetIcon size={12} />
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={() => updateSingleParam(key, Math.max(min, val - (key === 'hue' ? 5 : 1)))}
            title={`Step Down ${label}`}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#cbd5e1',
              borderRadius: '4px',
              width: '22px',
              height: '22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 'bold',
              lineHeight: 1,
              transition: 'all 0.1s ease'
            }}
          >
            -
          </button>
          <span style={{ fontSize: '0.62rem', color: '#64748b', minWidth: '18px', textAlign: 'right' }}>{min}</span>
          <input
            type="range"
            min={min}
            max={max}
            value={val}
            onChange={(e) => updateSingleParam(key, Number(e.target.value))}
            style={{
              flex: 1,
              height: '4px',
              borderRadius: '2px',
              accentColor: '#6366f1',
              cursor: 'pointer'
            }}
          />
          <span style={{ fontSize: '0.62rem', color: '#64748b', minWidth: '18px' }}>+{max}</span>
          <button
            type="button"
            onClick={() => updateSingleParam(key, Math.min(max, val + (key === 'hue' ? 5 : 1)))}
            title={`Step Up ${label}`}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#cbd5e1',
              borderRadius: '4px',
              width: '22px',
              height: '22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 'bold',
              lineHeight: 1,
              transition: 'all 0.1s ease'
            }}
          >
            +
          </button>
        </div>
        {subtext && <div style={{ fontSize: '0.66rem', color: '#94a3b8', marginTop: '3px', paddingLeft: '2px' }}>{subtext}</div>}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sliders size={16} className="text-indigo-400" />
          <span style={{ fontWeight: 700, fontSize: '0.84rem' }}>IMAGE ADJUSTMENTS</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            title="Undo slider change"
            style={{
              background: undoStack.length > 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              padding: '4px 6px',
              color: undoStack.length > 0 ? '#fff' : '#64748b',
              cursor: undoStack.length > 0 ? 'pointer' : 'default'
            }}
          >
            <RotateCcw size={13} />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            title="Redo slider change"
            style={{
              background: redoStack.length > 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              padding: '4px 6px',
              color: redoStack.length > 0 ? '#fff' : '#64748b',
              cursor: redoStack.length > 0 ? 'pointer' : 'default'
            }}
          >
            <RotateCw size={13} />
          </button>
        </div>
      </div>

      {appliedToast && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.25))',
          border: '1px solid rgba(16, 185, 129, 0.5)',
          color: '#6ee7b7',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '0.75rem',
          fontWeight: 700,
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.2)'
        }}>
          <Check size={14} className="text-emerald-400" />
          <span>{appliedToast}</span>
        </div>
      )}

      {copiedToast && (
        <div style={{
          background: 'rgba(99, 102, 241, 0.25)',
          border: '1px solid rgba(99, 102, 241, 0.5)',
          color: '#c7d2fe',
          padding: '6px 12px',
          borderRadius: '8px',
          fontSize: '0.74rem',
          fontWeight: 600,
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <Check size={13} />
          <span>Settings copied to clipboard!</span>
        </div>
      )}

      <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '8px', padding: '8px 12px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ImageIcon size={13} className="text-indigo-400" />
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#e2e8f0' }}>{activeRoom ? activeRoom.name : 'No active room'}</span>
          </div>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#a5b4fc' }}>{adjustments.preset || 'Original'}</span>
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', marginBottom: '8px', letterSpacing: '0.5px' }}>
          1-Click Presets & Filters
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {Object.keys(PRESETS).map((pName) => {
            const isActive = adjustments.preset === pName;
            return (
              <button
                key={pName}
                onClick={() => handleSelectPreset(pName)}
                style={{
                  padding: '4px 9px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: isActive ? 700 : 500,
                  background: isActive ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.06)',
                  color: isActive ? '#fff' : '#cbd5e1',
                  border: isActive ? '1px solid transparent' : '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {pName}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
        <div style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#818cf8', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Sun size={12} /> BASIC LIGHTING
          </div>
          {renderSlider('Brightness', 'brightness', -100, 100, '', <Sun size={12} className="text-amber-400" />)}
          {renderSlider('Contrast', 'contrast', -100, 100, '', <ContrastIcon size={12} className="text-blue-400" />)}
          {renderSlider('Exposure', 'exposure', -100, 100, '', <Eye size={12} className="text-indigo-400" />)}
        </div>

        <div style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#818cf8', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Palette size={12} /> COLOR & TEMPERATURE
          </div>
          {renderSlider('Saturation', 'saturation', -100, 100, '', <Palette size={12} className="text-pink-400" />)}
          {renderSlider('Hue Shift', 'hue', -180, 180, '°', <Sliders size={12} className="text-purple-400" />)}
          {renderSlider(
            'Temperature',
            'temperature',
            -100,
            100,
            '',
            <Thermometer size={12} className="text-orange-400" />,
            adjustments.temperature > 0 ? '☀️ Warmer (+Yellow)' : adjustments.temperature < 0 ? '❄️ Cooler (+Blue)' : 'Neutral'
          )}
        </div>

        <div style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#818cf8', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Sparkles size={12} /> EFFECTS & ENHANCEMENTS
          </div>
          {renderSlider('Sharpen', 'sharpen', 0, 100, '', <Sparkles size={12} className="text-cyan-400" />)}
          {renderSlider('Vignette', 'vignette', 0, 100, '', <Layers size={12} className="text-violet-400" />)}
        </div>
      </div>

      <div style={{ paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={handleCopyAdjustments}
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '0.74rem',
              fontWeight: 600,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#e2e8f0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            {copiedToast ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copiedToast ? 'Copied!' : 'Copy Settings'}</span>
          </button>

          <button
            onClick={handlePasteAdjustments}
            disabled={!copiedAdj}
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '0.74rem',
              fontWeight: 600,
              background: copiedAdj ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.02)',
              border: copiedAdj ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.06)',
              color: copiedAdj ? '#a5b4fc' : '#64748b',
              cursor: copiedAdj ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <ClipboardCheck size={13} />
            <span>Paste Settings</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setShowSelectModal(true)}
            style={{
              flex: 1,
              padding: '6px 8px',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: 600,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#cbd5e1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <CheckSquare size={12} />
            <span>Apply Selected</span>
          </button>

          <button
            onClick={handleConfirmApplyToAll}
            style={{
              flex: 1,
              padding: '6px 8px',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #10b981, #059669)',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              boxShadow: '0 4px 12px rgba(16,185,129,0.3)'
            }}
          >
            <Globe size={12} />
            <span>Apply to All</span>
          </button>
        </div>

        <button
          onClick={handleResetAll}
          style={{
            width: '100%',
            padding: '5px',
            borderRadius: '6px',
            fontSize: '0.7rem',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            textAlign: 'center',
            marginTop: '2px'
          }}
        >
          ↺ Reset All to Original
        </button>
      </div>

      {showSelectModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSelectModal(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(5, 7, 15, 0.88)',
            backdropFilter: 'blur(12px)'
          }}
        >
          <div
            style={{
              width: '90%',
              maxWidth: '420px',
              background: 'linear-gradient(160deg, #13162a 0%, #1a1d30 100%)',
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: '16px',
              padding: '20px',
              color: '#fff'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckSquare size={18} className="text-indigo-400" />
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Apply Adjustments to Selected Rooms</span>
              </div>
              <button onClick={() => setShowSelectModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '12px' }}>
              Select the rooms you want to apply the current visual adjustments ({adjustments.preset || 'Custom'}) to:
            </div>

            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '18px' }}>
              {locations.map((loc) => {
                const isSelected = selectedLocationIds.includes(loc.id);
                return (
                  <div
                    key={loc.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedLocationIds((ids) => ids.filter((id) => id !== loc.id));
                      } else {
                        setSelectedLocationIds((ids) => [...ids, loc.id]);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: isSelected ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                      border: isSelected ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.08)',
                      cursor: 'pointer'
                    }}
                  >
                    {isSelected ? <CheckSquare size={16} className="text-indigo-400" /> : <Square size={16} className="text-gray-500" />}
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isSelected ? '#fff' : '#cbd5e1' }}>{loc.name}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setShowSelectModal(false)}
                style={{ padding: '6px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', border: 'none', color: '#94a3b8', fontSize: '0.78rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApplyToSelected}
                disabled={selectedLocationIds.length === 0}
                style={{
                  padding: '6px 18px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  opacity: selectedLocationIds.length > 0 ? 1 : 0.5
                }}
              >
                Apply to {selectedLocationIds.length} Room(s)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
