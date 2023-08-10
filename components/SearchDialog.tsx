import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useCompletion } from 'ai/react'
import { X, Loader, User, Frown, CornerDownLeft, Search, Wand, ArrowLeftCircle } from 'lucide-react'

type Question = {
  key: string
  text: string
}

  type QuestionKey = 'root' | 'A' | 'B';

type QuestionTreeNode = Record<string, string>
const QUESTIONS_TREE: Record<QuestionKey, QuestionTreeNode> = {
  root: {
    A: 'Who is Alex?',
    B: 'Where is Alex?',
  },
  A: {
    C: 'Has he worked anywhere?',
    D: 'Does he have skills?',
    E: 'What has he accomplished?',
  },
  B: {
    F: 'Is it nice there?',
    G: 'Can he travel?',
    H: 'Will he come into an office?',
  },
}

const DEFAULT_QUESTIONS = Object.entries(QUESTIONS_TREE.root).map(([key, text]) => ({ key, text }));
let historyStack: QuestionKey[] = [];

export function SearchDialog() {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState<string>('')
  const [currentQuestions, setCurrentQuestions] = React.useState<Question[]>(
    Object.entries(QUESTIONS_TREE.root).map(([key, text]) => ({ key, text }))
  )

  const { complete, completion, isLoading, error } = useCompletion({
    api: '/api/vector-search',
  })

  const [showMoreOptions, setShowMoreOptions] = React.useState(false);


  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && e.metaKey) {
        setOpen(true)
      }

      if (e.key === 'Escape') {
        handleModalToggle()
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault()
    complete(query)
  }

  function handleModalToggle() {
    setOpen(!open);
    setQuery('');
    setShowMoreOptions(false);
    setCurrentQuestions(DEFAULT_QUESTIONS);
    historyStack = [];
  }

  function setQuestionsBasedOnSelection(selectedKey: string) {
    historyStack.push(selectedKey as QuestionKey);

    const questionText = currentQuestions.find((q) => q.key === selectedKey)?.text || '';
    setQuery(questionText); // This sets the selected question text to the query box

    const nextQuestionsObj = QUESTIONS_TREE[selectedKey as QuestionKey];
    if (nextQuestionsObj) {
      const nextQuestionsArray: [string, string][] = Object.entries(nextQuestionsObj);
      setCurrentQuestions(nextQuestionsArray.map(([key, text]) => ({ key, text })));
    } else {
      complete(questionText);
    }
  }


  function handleGoBack() {
    if (historyStack.length > 1) {
      historyStack.pop();
      const prevKey = historyStack[historyStack.length - 1];
      const prevQuestionsObj = QUESTIONS_TREE[prevKey];
      setCurrentQuestions(Object.entries(prevQuestionsObj).map(([key, text]) => ({ key, text })));
      setShowMoreOptions(true);
    } else {
      setCurrentQuestions(DEFAULT_QUESTIONS);
      historyStack = [];
      setShowMoreOptions(false);
    }
  }

  return (
    <>
                    <div className="relative">
      <div className="flex justify-center items-center h-screen">
        <button
          onClick={() => setOpen(true)}
          className="text-base flex gap-2 items-center px-4 py-2 z-50 relative
  text-slate-500 dark:text-slate-400  hover:text-slate-700 dark:hover:text-slate-300
  rounded-md
  border border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-500
  shadow-md hover:shadow-lg transition-shadow
  bg-white dark:bg-gray-700
  min-w-[300px]"
        >
          <Search width={15} />
          <span className="border border-l h-5"></span>
          <span className="inline-block ml-4">Ask...</span>
          <kbd
            className="absolute right-3 top-2.5
            pointer-events-none inline-flex h-5 select-none items-center gap-1
            rounded border border-slate-100 bg-slate-100 px-1.5
            font-mono text-[10px] font-medium
            text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400
            opacity-100 "
          >
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>
      </div>
      <Dialog open={open}>
        <DialogContent className={`sm:max-w-[850px] text-black  `}>
          {' '}
          <DialogHeader>
            <DialogTitle>Want to know Alex?</DialogTitle>
            <DialogDescription>
              Explore my career with Next.js, OpenAI & Supabase.
            </DialogDescription>
            <hr />
            <button className="absolute top-0 right-2 p-2" onClick={() => setOpen(false)}>
              <X className="h-4 w-4 dark:text-gray-100" />
            </button>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-3 py-4 text-slate-700">
              {query && (
                <div className="flex">
                  <p className="mt-0.5 font-semibold text-slate-700 dark:text-slate-100">{query}</p>
                </div>
              )}

              {isLoading && (
                <div className="animate-spin relative flex w-5 h-5 ml-2">
                  <Loader />
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2">
                  <span className="bg-red-100 p-2 w-8 h-8 rounded-full text-center flex items-center justify-center">
                    <Frown width={18} />
                  </span>
                  <span className="text-slate-700 dark:text-slate-100">
                    Ah, sorry. Maintenance mode at the moment, come back later.
                  </span>
                </div>
              )}

              {completion && !error ? (
                <div className="flex items-center gap-4 dark:text-white">{completion}</div>
              ) : null}

              <div className="relative">
                <Input
                  placeholder="Ask a question..."
                  name="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="col-span-3"
                />
                <CornerDownLeft
                  className={`absolute top-3 right-5 h-4 w-4 text-gray-300 transition-opacity ${
                    query ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              </div>
              <div className="text-m text-gray-500 dark:text-gray-100">
                Or try:{' '}
                <button
                  type="button"
                  className="px-1.5 py-0.5
                  bg-slate-50 dark:bg-gray-500
                  hover:bg-slate-100 dark:hover:bg-gray-600
                  rounded border border-slate-200 dark:border-slate-600
                  transition-colors"
                  onClick={(_) => setQuery('Who is Alex Welcing?')}
                >
                  Who is Alex Welcing?
                </button>
                <button
                  type="button"

                  className="px-1.5 py-0.5 m-2
                  bg-slate-50 dark:bg-gray-500
                  hover:bg-slate-100 dark:hover:bg-gray-600
                  rounded border border-slate-200 dark:border-slate-600
                  transition-colors"
                  onClick={(_) =>
                    setQuery(
                      'Where has Alex Welcing worked previously and what did he accomplish there?'
                    )
                  }
                >
                  Where has he worked previously and what did he accomplish?
                </button>
              </div>
              <div className="flex flex-wrap">
        {historyStack.length > 0 && (
          <button
            className="bg-teal-100 hover:bg-teal-200 text-teal-700 p-2 rounded m-2"
            onClick={handleGoBack}
          >
            <ArrowLeftCircle width={18} />
          </button>
        )}
        {currentQuestions.map((question) => (
          <button
            key={question.key}
            type="button"
            className="px-1.5 py-0.5 m-2
              bg-teal-50 dark:bg-gray-300
              hover:bg-teal-100 dark:hover:bg-gray-400
              rounded border border-teal-200 dark:border-gray-500
              transition-colors"
            onClick={() => {
              setQuestionsBasedOnSelection(question.key);
            }}
          >
            {question.text}
          </button>
        ))}
      </div>
      {showMoreOptions && currentQuestions.map((question) => (
        <button
          key={question.key}
          className="bg-blue-100 hover:bg-blue-200 text-blue-700 p-2 rounded m-2"
        >
          {question.text}
        </button>
      ))}
            </div>
            {showMoreOptions && currentQuestions.map((question) => (
          <button
            key={question.key}
            className="bg-blue-100 hover:bg-blue-200 text-blue-700 p-2 rounded m-2"
          >
            {question.text}
          </button>
        ))}


            <DialogFooter>
              <Button type="submit" className="bg-red-500">
                Ask
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      </div>
    </>
  )
}

export default SearchDialog
