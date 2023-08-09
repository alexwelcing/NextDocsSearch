import * as React from 'react'
import { Button } from '@/components/ui/button'
import { useCompletion } from 'ai/react'
import { User, Frown, CornerDownLeft, Search, Wand } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { X, Loader } from 'lucide-react'

type QuestionKey = 'root' | 'A' | 'B'
type Question = {
  key: string
  text: string
}

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

interface SearchBarProps {
  currentImage: string
  onImageChange: (imageUrl: string) => void
}

const SearchBar: React.FC<SearchBarProps> = ({ currentImage, onImageChange }) => {
  const [query, setQuery] = React.useState<string>('')
  const { complete, completion, isLoading, error } = useCompletion({
    api: '/api/vector-search',
  })

  const [open, setOpen] = React.useState(false)
  const [currentQuestions, setCurrentQuestions] = React.useState<Question[]>(
    Object.entries(QUESTIONS_TREE.root).map(([key, text]) => ({ key, text }))
  )

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
  }, [])

  function handleModalToggle() {
    setOpen((prev) => !prev)
    setQuery('')
  }

  function setQuestionsBasedOnSelection(selectedKey: string) {
    const questionText = currentQuestions.find((q) => q.key === selectedKey)?.text || ''
    setQuery(questionText)

    const nextQuestionsObj = QUESTIONS_TREE[selectedKey as QuestionKey]
    if (nextQuestionsObj) {
      const nextQuestionsArray: [string, string][] = Object.entries(nextQuestionsObj)
      setCurrentQuestions(nextQuestionsArray.map(([key, text]) => ({ key, text })))
    } else {
      complete(questionText)
    }
  }

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault()
    complete(query)
  }

  return (
    <>
      <button onClick={handleModalToggle}>
        <Search width={15} />
        <span className="border border-l h-5"></span>
        <span className="inline-block ml-4">Chat...</span>
      </button>

      {open && (
        <Dialog>
          <DialogContent className="sm:max-w-[850px] text-black">
            <DialogHeader>
              <DialogTitle>Want to know Alex?</DialogTitle>
              <hr />
              <button className="absolute top-0 right-2 p-2" onClick={handleModalToggle}>
                <X className="h-4 w-4 dark:text-gray-100" />
              </button>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4 text-slate-700">
                {query && (
                  <div className="flex gap-4">
                    <span className="bg-slate-100 dark:bg-slate-300 p-2 w-8 h-8 rounded-full text-center flex items-center justify-center">
                      <User width={18} />{' '}
                    </span>
                    <p className="mt-0.5 font-semibold text-slate-700 dark:text-slate-100">
                      {query}
                    </p>
                  </div>
                )}

                {isLoading && (
                  <div className="animate-spin relative flex w-5 h-5 ml-2">
                    <Loader />
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-4">
                    <span className="bg-red-100 p-2 w-8 h-8 rounded-full text-center flex items-center justify-center">
                      <Frown width={18} />
                    </span>
                    <span className="text-slate-700 dark:text-slate-100">
                      Ah, sorry. Maintenance mode at the moment, come back later.
                    </span>
                  </div>
                )}

                {completion && !error ? (
                  <div className="flex items-center gap-4 dark:text-white">
                    <span className="bg-green-500 p-2 w-8 h-8 rounded-full text-center flex items-center justify-center">
                      <Wand width={18} className="text-white" />
                    </span>
                    {completion}
                  </div>
                ) : null}

                <div className="relative">
                  <Input
                    placeholder="What would you want to know?"
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
                <div className="text-xs text-gray-500 dark:text-gray-100">
                  Or try:
                  {currentQuestions.map(({ key, text }) => (
                    <button
                      key={key}
                      type="button"
                      className="px-1.5 py-0.5
                    bg-slate-50 dark:bg-gray-500
                    hover:bg-slate-100 dark:hover:bg-gray-600 space-x-2
                    rounded border border-slate-200 dark:border-slate-600
                    transition-colors"
                      onClick={() => setQuestionsBasedOnSelection(key)}
                    >
                      {text}
                    </button>
                  ))}
                </div>
                <DialogFooter>
                  <Button type="submit" className="bg-red-500">
                    Ask
                  </Button>
                </DialogFooter>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

export default SearchBar
