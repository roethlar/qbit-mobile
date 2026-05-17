import { memo } from 'react';
import {
  Play, Pause, Trash2, FolderInput,
  Check, ChevronDown, ChevronRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { Torrent } from '../types/qbittorrent';
import { PAUSED_STATES_SET } from '../types/qbittorrent';
import {
  formatBytes, formatSpeed, formatProgress, formatTime, formatRatio, formatDate,
  getStateColor, getStateText,
} from '../utils/formatters';
import { useSwipeGesture } from '../hooks/useSwipeGesture';

export type RowAction = 'toggle' | 'delete' | 'move' | 'detail';
export type SwipeAction = 'move' | 'delete';

const isPausedState = (state: Torrent['state']) => PAUSED_STATES_SET.has(state);

interface CompactTorrentRowProps {
  torrent: Torrent;
  selectMode: boolean;
  isSelected: boolean;
  isExpanded: boolean;
  onClick: (torrent: Torrent) => void;
  onAction: (torrent: Torrent, action: RowAction) => void;
  onSwipeAction: (torrent: Torrent, action: SwipeAction) => void;
}

export const CompactTorrentRow = memo(function CompactTorrentRow({
  torrent,
  selectMode,
  isSelected,
  isExpanded,
  onClick,
  onAction,
  onSwipeAction,
}: CompactTorrentRowProps) {
  const isActive = torrent.state === 'downloading' || torrent.state === 'uploading';
  const isPaused = isPausedState(torrent.state);

  // Swipe is disabled in select mode (checkboxes own the row) and when the row
  // is already expanded (sliding the expansion is jarring).
  const { swipeDx, isDragging, handlers, guardClick } = useSwipeGesture({
    enabled: !selectMode && !isExpanded,
    onMove: () => onSwipeAction(torrent, 'move'),
    onDelete: () => onSwipeAction(torrent, 'delete'),
  });

  const handleClick = guardClick(() => onClick(torrent));

  const showMoveReveal = swipeDx > 0;
  const showDeleteReveal = swipeDx < 0;

  return (
    <div
      className="relative overflow-hidden"
      // pan-y lets the browser handle vertical scroll while leaving horizontal
      // gestures for us. Saves us from preventDefault dances inside touchmove.
      style={{ touchAction: 'pan-y' }}
    >
      {swipeDx !== 0 && (
        <div className="absolute inset-0 flex pointer-events-none" aria-hidden="true">
          <div
            className={clsx(
              'flex-1 bg-blue-600 flex items-center pl-4 transition-opacity',
              showMoveReveal ? 'opacity-100' : 'opacity-0',
            )}
          >
            <FolderInput className="w-5 h-5 text-white" />
            <span className="ml-2 text-sm font-medium text-white">Move</span>
          </div>
          <div
            className={clsx(
              'flex-1 bg-red-600 flex items-center justify-end pr-4 transition-opacity',
              showDeleteReveal ? 'opacity-100' : 'opacity-0',
            )}
          >
            <span className="mr-2 text-sm font-medium text-white">Delete</span>
            <Trash2 className="w-5 h-5 text-white" />
          </div>
        </div>
      )}

      <div
        {...handlers}
        onClick={handleClick}
        style={{
          transform: `translateX(${swipeDx}px)`,
          transition: isDragging ? 'none' : 'transform 200ms ease-out',
        }}
        className={clsx(
          'relative border-b border-gray-100 dark:border-gray-700 px-2 py-1.5 cursor-pointer',
          // Solid bg so the reveal layer is hidden until the row slides.
          // Matches the page bg in both themes.
          'bg-gray-50 dark:bg-gray-950',
          isSelected
            ? 'bg-primary-50 dark:bg-primary-900/20 border-l-2 border-l-primary-600'
            : isExpanded
              ? 'bg-gray-100 dark:bg-gray-800'
              : 'active:bg-gray-100 dark:active:bg-gray-800',
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0 mr-3">
            <div className="flex items-center">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 text-xs leading-tight truncate selectable">
                {torrent.name}
              </h3>
              <span className={clsx('ml-2 text-xs font-medium flex-shrink-0', getStateColor(torrent.state))}>
                {getStateText(torrent.state)}
              </span>
            </div>

            <div
              className="w-full bg-gray-200 rounded-full h-0.5 mt-0.5"
              role="progressbar"
              aria-valuenow={Math.round(torrent.progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${torrent.name} progress`}
            >
              <div
                className={clsx(
                  'h-0.5 rounded-full transition-all duration-300',
                  isActive ? 'bg-blue-500' : isPaused ? 'bg-gray-400' : 'bg-green-500',
                )}
                style={{ width: `${torrent.progress * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-gray-600 mt-0.5">
              <div className="flex items-center space-x-3">
                <span>{formatProgress(torrent.progress)}</span>
                <span>{formatBytes(torrent.size)}</span>
                {(torrent.dlspeed > 0 || torrent.upspeed > 0) && (
                  <div className="flex items-center space-x-1">
                    {torrent.dlspeed > 0 && (
                      <span className="text-blue-600">↓{formatSpeed(torrent.dlspeed)}</span>
                    )}
                    {torrent.upspeed > 0 && (
                      <span className="text-green-600">↑{formatSpeed(torrent.upspeed)}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {selectMode ? (
            <button
              onClick={(e) => { e.stopPropagation(); onClick(torrent); }}
              aria-label={isSelected ? `Deselect ${torrent.name}` : `Select ${torrent.name}`}
              aria-pressed={isSelected}
              className={clsx(
                'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                isSelected
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'border-gray-300 dark:border-gray-500',
              )}
            >
              {isSelected && <Check className="w-4 h-4" />}
            </button>
          ) : (
            <ChevronDown
              className={clsx(
                'w-4 h-4 text-gray-400 flex-shrink-0 transition-transform',
                isExpanded && 'rotate-180',
              )}
              aria-hidden="true"
            />
          )}
        </div>

        {isExpanded && !selectMode && (
          <ExpandedDetail torrent={torrent} isPaused={isPaused} onAction={onAction} />
        )}
      </div>
    </div>
  );
});

interface ExpandedDetailProps {
  torrent: Torrent;
  isPaused: boolean;
  onAction: (torrent: Torrent, action: RowAction) => void;
}

function ExpandedDetail({ torrent, isPaused, onAction }: ExpandedDetailProps) {
  // Stop click bubble: tapping inside the expansion shouldn't collapse the row.
  return (
    <div
      className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 space-y-2"
      onClick={(e) => e.stopPropagation()}
    >
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <Stat label="ETA" value={formatTime(torrent.eta)} />
        <Stat label="Ratio" value={formatRatio(torrent.ratio)} />
        <Stat label="Seeds" value={`${torrent.num_seeds} / ${torrent.num_complete}`} />
        <Stat label="Peers" value={`${torrent.num_leechs} / ${torrent.num_incomplete}`} />
        <Stat label="Added" value={formatDate(torrent.added_on)} />
        <Stat
          label="Completed"
          value={torrent.completion_on > 0 ? formatDate(torrent.completion_on) : '—'}
        />
        <div className="col-span-2 flex gap-2">
          <dt className="text-gray-500 dark:text-gray-400 flex-shrink-0">Path</dt>
          <dd className="text-gray-900 dark:text-gray-100 truncate selectable" title={torrent.save_path}>
            {torrent.save_path || '—'}
          </dd>
        </div>
      </dl>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <ActionButton
          label={isPaused ? 'Resume' : 'Pause'}
          icon={isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          tone={isPaused ? 'positive' : 'neutral'}
          onClick={() => onAction(torrent, 'toggle')}
        />
        <ActionButton
          label="Details"
          icon={<ChevronRight className="w-4 h-4" />}
          onClick={() => onAction(torrent, 'detail')}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-gray-900 dark:text-gray-100 text-right selectable">{value}</dd>
    </>
  );
}

interface ActionButtonProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'neutral' | 'positive' | 'danger';
}

function ActionButton({ label, icon, onClick, disabled, tone = 'neutral' }: ActionButtonProps) {
  const toneClasses =
    tone === 'danger'
      ? 'text-red-600 dark:text-red-400 active:bg-red-50 dark:active:bg-red-900/20'
      : tone === 'positive'
        ? 'text-green-600 dark:text-green-400 active:bg-green-50 dark:active:bg-green-900/20'
        : 'text-gray-700 dark:text-gray-200 active:bg-gray-100 dark:active:bg-gray-700';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={clsx(
        'flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition-colors disabled:opacity-50 min-w-0',
        toneClasses,
      )}
    >
      {icon}
      <span className="text-[10px] mt-0.5 w-full text-center truncate">{label}</span>
    </button>
  );
}
