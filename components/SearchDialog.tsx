import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { X, Loader, Frown, CornerDownLeft, Search, ArrowLeftCircle, Zap, BookOpen, Wand, Compass } from 'lucide-react';
import { useSupabaseData } from './contexts/SupabaseDataContext';
import { SHIP_TRICKS } from '@/lib/ai/shipTricks';
import {
  isShipAiErrorMessage,
  isShipAiIdleMessage,
  isShipAiLoadingMessage,
  SHIP_AI_IDLE_MESSAGE,
} from '@/lib/hooks/useChat';
import ShipAnswerPanel from '@/components/chat/ShipAnswerPanel';

type Question = {
  key: string;
  text: string;
};

type QuestionKey = 'root' | 'A' | 'B';

type QuestionTreeNode = Record<string, string>;

const QUESTIONS_TREE: Record<QuestionKey, QuestionTreeNode> = {
  root: {
    A: 'What is Alex\'s product management approach?',
    B: 'How does Alex approach business transformation?',
  },
  A: {
    C: 'What leadership roles has Alex held?',
    D: 'How does Alex foster team collaboration?',
    E: 'What is Alex\'s approach to conflict resolution?',
  },
  B: {
    F: 'Can Alex provide examples of successful transformations?',
    G: 'How does Alex measure the impact of transformation?',
    H: 'In which industries has Alex contributed?',
  },
};

const EXPLORATION_HINTS = [
  { icon: Zap, text: 'Try /story to analyze articles as narrative systems', command: '/story ' },
  { icon: BookOpen, text: 'Use /brief for executive summaries', command: '/brief ' },
  { icon: Wand, text: 'Ask about The Reaching or speculative AI work', command: 'Tell me about The Reaching' },
  { icon: Compass, text: 'Use /map to see systems thinking across topics', command: '/map ' },
];

const DEFAULT_QUESTIONS = Object.entries(QUESTIONS_TREE.root).map(([key, text]) => ({ key, text }));
let historyStack: QuestionKey[] = [];

function CommandHints({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div className="rounded-xl border border-slate-200/50 bg-slate-50/50 p-4 dark:border-slate-700/50 dark:bg-slate-800/50">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        <Zap className="h-3.5 w-3.5" />
        Ways to explore
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {EXPLORATION_HINTS.map((hint, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onSelect(hint.command)}
            className="flex items-start gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-white dark:hover:bg-slate-700/50"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-100 dark:bg-cyan-900/30">
              <hint.icon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              {hint.text}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function IdleState({ onHintSelect }: { onHintSelect: (text: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border border-cyan-200/50 bg-gradient-to-r from-cyan-50/50 to-transparent p-4 dark:border-cyan-800/30 dark:from-cyan-900/20">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-100 dark:bg-cyan-800/30">
          <Zap className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
        </div>
        <div>
          <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
            Ship AI is online
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Ask questions about Alex&apos;s work, use /commands for special modes, or explore suggested topics below.
          </div>
        </div>
      </div>
      <CommandHints onSelect={onHintSelect} />
    </div>
  );
}

function QuickTricks({ onSelect }: { onSelect: (command: string) => void }) {
  const [showAll, setShowAll] = React.useState(false);
  const visibleTricks = showAll ? SHIP_TRICKS : SHIP_TRICKS.slice(0, 4);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {visibleTricks.map((trick) => (
          <button
            key={trick.id}
            type="button"
            onClick={() => onSelect(trick.command)}
            className="group relative overflow-hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-all hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-cyan-700 dark:hover:bg-cyan-900/20 dark:hover:text-cyan-300"
          >
            <span className="relative z-10">{trick.command}</span>
            <span className="ml-1.5 text-[10px] text-slate-400 group-hover:text-cyan-500 dark:text-slate-500">
              {trick.label}
            </span>
          </button>
        ))}
        {!showAll && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="rounded-full border border-dashed border-slate-300 bg-transparent px-3 py-1.5 text-xs text-slate-400 transition-colors hover:border-slate-400 hover:text-slate-500 dark:border-slate-600 dark:text-slate-500 dark:hover:border-slate-500 dark:hover:text-slate-400"
          >
            +{SHIP_TRICKS.length - 4} more
          </button>
        )}
      </div>
    </div>
  );
}

export function SearchDialog() {
  const { sendMessage, chatData } = useSupabaseData();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState<string>('');
  const [currentQuestions, setCurrentQuestions] = React.useState<Question[]>(
    Object.entries(QUESTIONS_TREE.root).map(([key, text]) => ({ key, text }))
  );
  const [showMoreOptions, setShowMoreOptions] = React.useState(false);
  const isLoading = isShipAiLoadingMessage(chatData.response);
  const hasRenderableAnswer =
    chatData.instantResults.length > 0 ||
    (Boolean(chatData.response) && !isShipAiIdleMessage(chatData.response) && !isShipAiErrorMessage(chatData.response));
  const isIdle = !hasRenderableAnswer && !isLoading && !isShipAiErrorMessage(chatData.response);

  const handleModalToggle = React.useCallback(() => {
    setOpen(!open);
    setQuery('');
    setShowMoreOptions(false);
    setCurrentQuestions(DEFAULT_QUESTIONS);
    historyStack = [];
  }, [open]);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && e.metaKey) {
        setOpen(true);
      }

      if (e.key === 'Escape') {
        handleModalToggle();
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [handleModalToggle]);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    sendMessage(query);
  };

  const applyTrick = React.useCallback((command: string) => {
    setQuery((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${command} ${trimmed}` : `${command} `;
    });
  }, []);

  function setQuestionsBasedOnSelection(selectedKey: string) {
    historyStack.push(selectedKey as QuestionKey);

    const questionText = currentQuestions.find((q) => q.key === selectedKey)?.text || '';
    setQuery(questionText);

    const nextQuestionsObj = QUESTIONS_TREE[selectedKey as QuestionKey];
    if (nextQuestionsObj) {
      const nextQuestionsArray: [string, string][] = Object.entries(nextQuestionsObj);
      setCurrentQuestions(nextQuestionsArray.map(([key, text]) => ({ key, text })));
      setShowMoreOptions(true);
    }
  }

  function handleGoBack() {
    if (historyStack.length > 1) {
      historyStack.pop();
      const prevKey = historyStack[historyStack.length - 1];
      const prevQuestionsObj = QUESTIONS_TREE[prevKey];
      setCurrentQuestions(Object.entries(prevQuestionsObj).map(([key, text]) => ({ key, text })));
      if (historyStack.length === 1) {
        setShowMoreOptions(false);
      } else {
        setShowMoreOptions(true);
      }
    } else {
      setCurrentQuestions(DEFAULT_QUESTIONS);
      historyStack = [];
      setShowMoreOptions(false);
    }
  }

  return (
    <>
      <div className="relative">
        <div className="flex justify-end items-start pt-4">
          <button
            onClick={() => setOpen(true)}
            className="text-base flex gap-2 items-center px-4 py-2 z-50
              text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300
              rounded-md
              border border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-500
              shadow-md hover:shadow-lg transition-shadow
              bg-white dark:bg-gray-700
              min-w-[200px]"
          >
            <Search width={15} />
            <span className="border border-l h-5"></span>
            <span className="inline-block ml-4">Ask AI...</span>
            <kbd className="ml-auto hidden rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-600 dark:text-slate-400 sm:inline-block">
              ⌘K
            </kbd>
          </button>
        </div>
        <Dialog open={open}>
          <DialogContent className={`sm:max-w-[980px] text-black`}>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-lg">Ship AI</DialogTitle>
                  <DialogDescription className="text-sm">
                    Ask naturally or use /commands for specialized modes
                  </DialogDescription>
                </div>
              </div>
              <button className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" onClick={() => setOpen(false)}>
                <X className="h-4 w-4 dark:text-gray-100" />
              </button>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4 text-slate-700">
                {query && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-[0.14em] text-slate-400">Query</span>
                    <p className="font-medium text-slate-800 dark:text-slate-200">{query}</p>
                  </div>
                )}

                {isLoading && (
                  <div className="flex items-center gap-3 rounded-lg border border-cyan-200/50 bg-cyan-50/30 p-3 dark:border-cyan-800/30 dark:bg-cyan-900/10">
                    <div className="animate-spin">
                      <Loader className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      Ship AI is searching the archive...
                    </div>
                  </div>
                )}

                {isShipAiErrorMessage(chatData.response) && (
                  <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/30 dark:bg-red-900/10">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                      <Frown className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </span>
                    <span className="text-sm text-slate-700 dark:text-slate-200">
                      The model choked. Ask again and Ship AI will take another swing.
                    </span>
                  </div>
                )}

                {hasRenderableAnswer ? (
                  <ShipAnswerPanel chatData={chatData} density="full" />
                ) : isIdle ? (
                  <IdleState onHintSelect={setQuery} />
                ) : null}

                <div className="space-y-3">
                  <div className="relative">
                    <Input
                      placeholder="Ask a question or use /brief, /signal, /map, /roast..."
                      name="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="col-span-3 pr-12"
                    />
                    <CornerDownLeft
                      className={`absolute top-3 right-5 h-4 w-4 text-gray-300 transition-opacity ${query ? 'opacity-100' : 'opacity-0'
                        }`}
                    />
                  </div>

                  <QuickTricks onSelect={applyTrick} />

                  <div className="flex flex-wrap items-center gap-2">
                    {historyStack.length > 0 && (
                      <button
                        type="button"
                        className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        onClick={handleGoBack}
                      >
                        <ArrowLeftCircle className="h-3.5 w-3.5" />
                        Back
                      </button>
                    )}
                    {currentQuestions.map((question) => (
                      <button
                        key={question.key}
                        type="button"
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition-colors hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-cyan-700 dark:hover:bg-cyan-900/20 dark:hover:text-cyan-300"
                        onClick={() => setQuestionsBasedOnSelection(question.key)}
                      >
                        {question.text}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <div className="mr-auto flex items-center gap-2 text-xs text-slate-400">
                  <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 dark:border-slate-700 dark:bg-slate-800">ESC</kbd>
                  <span>to close</span>
                </div>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 text-white hover:from-cyan-700 hover:to-blue-700 disabled:opacity-50"
                  disabled={!query.trim() || isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Ask Ship AI
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}

export default SearchDialog
