import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useCompletion } from 'ai/react';
import { X, Loader, User, Frown, CornerDownLeft, Search, Wand } from 'lucide-react';

type QuestionKey = 'root' | 'A' | 'B';
type Question = {
    key: string;
    text: string;
};
type QuestionTreeNode = Record<string, string>;

interface Props {
    sendRequestToSupabase: (query: string) => void;
}

const Walkie: React.FC<Props> = ({ sendRequestToSupabase }) => {
    const QUESTIONS_TREE: Record<QuestionKey, QuestionTreeNode> = {
        root: {
            A: "Who is Alex?",
            B: "Where is Alex?"
        },
        A: {
            C: "Has he worked anywhere?",
            D: "Does he have skills?",
            E: "What has he accomplished?"
        },
        B: {
            F: "Is it nice there?",
            G: "Can he travel?",
            H: "Will he come into an office?"
        }
    };

    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState<string>('');
    const [currentQuestions, setCurrentQuestions] = useState<Question[]>(
        Object.entries(QUESTIONS_TREE.root).map(([key, text]) => ({ key, text }))
    );
    const { complete, completion, isLoading, error } = useCompletion({
        api: '/api/vector-search',
    });

    const handleModalToggle = () => {
        setOpen(!open);
        setQuery('');
        // Add sendGAEvent('chat_opened') if GA is integrated.
    };

    const setQuestionsBasedOnSelection = (selectedKey: string) => {
        const questionText = currentQuestions.find(q => q.key === selectedKey)?.text || '';
        setQuery(questionText);
        const nextQuestionsObj = QUESTIONS_TREE[selectedKey as QuestionKey];
        if (nextQuestionsObj) {
            const nextQuestionsArray: [string, string][] = Object.entries(nextQuestionsObj);
            setCurrentQuestions(nextQuestionsArray.map(([key, text]) => ({ key, text })));
        } else {
            complete(questionText);
        }
    };

    useEffect(() => {
        if (completion && !error) {
            // Handle completion if needed.
        }
    }, [completion, error]);

    const handleSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
        e.preventDefault();
        complete(query);
        // trackEvent('question_submitted', { question_text: query }) if tracking is integrated.
    };

    return (
        <>
            <button
                onClick={handleModalToggle}
                className="text-base flex gap-2 items-center px-4 py-2 absolute top-4 right-4 z-50
    text-slate-500 dark:text-slate-400  hover:text-slate-700 dark:hover:text-slate-300
    transition-colors
    rounded-md
    border border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-500
    min-w-[300px]"
            >
                <Search width={15} />
                <span className="border border-l h-5"></span>
                <span className="inline-block ml-4">Chat...</span>
                <kbd className="absolute right-3 top-2.5 pointer-events-none inline-flex h-5 select-none items-center gap-1
    rounded border border-slate-100 bg-slate-100 px-1.5
    font-mono text-[10px] font-medium
    text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400
    opacity-100"
                >
                    <span className="text-xs">⌘</span>K
                </kbd>
            </button>

            <Dialog open={open}>
                <DialogContent className="max-w-md">
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
                        <div className="grid gap-4 py-4 text-slate-700">
                            {query && (
                                <div className="flex gap-4">
                                    <span className="bg-slate-100 dark:bg-slate-300 p-2 w-8 h-8 rounded-full text-center flex items-center justify-center">
                                        <User width={18} />{' '}
                                    </span>
                                    <p className="mt-0.5 font-semibold text-slate-700 dark:text-slate-100">{query}</p>
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
                                    className={`absolute top-3 right-5 h-4 w-4 text-gray-300 transition-opacity ${query ? 'opacity-100' : 'opacity-0'
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
                        </div>          </form>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default Walkie;
