import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useCompletion } from 'ai/react';
import { X, Loader, User, Frown, CornerDownLeft, Search, Wand } from 'lucide-react';

type QuestionKey = 'root' | 'A' | 'B' | 'C';
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
            A: "Background Information about Alex",
            B: "Skills and Expertise",
            C: "Availability and Preferences"
        },
        A: {
            D: "Educational qualifications?",
            E: "Work experience?",
            F: "Major accomplishments?"
        },
        B: {
            G: "Technical skills?",
            H: "Soft skills?",
            I: "Certifications or courses?"
        },
        C: {
            J: "Willingness to relocate?",
            K: "Expected salary or compensation?",
            L: "Preferred working mode?"
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

    const goBack = () => {
        if (!query) return; // No need to go back from the root

        let previousKey: QuestionKey | null = null;
        for (const [key, value] of Object.entries(QUESTIONS_TREE)) {
            if (Object.values(value).includes(query)) {
                previousKey = key as QuestionKey;
                break;
            }
        }

        if (previousKey) {
            setCurrentQuestions(Object.entries(QUESTIONS_TREE[previousKey]).map(([key, text]) => ({ key, text })));
            setQuery('');
        } else {
            setCurrentQuestions(Object.entries(QUESTIONS_TREE.root).map(([key, text]) => ({ key, text })));
            setQuery('');
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
                className="text-base flex gap-2 items-center px-4 py-2 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50
    text-slate-500 dark:text-slate-400  hover:text-slate-700 dark:hover:text-slate-300
    transition-colors
    rounded-md
    border border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-500
    min-w-[300px]
    shadow-xl bg-white dark:bg-gray-900"  // Enhanced styling here
            >
                <Search width={15} />
                <span className="border border-l h-5"></span>
                <span className="inline-block ml-4 text-2xl">Want to talk?</span>  {/* Increased font size */}
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
                        <div className="text-xs text-gray-500 dark:text-gray-100">
                            Or try:
                            {currentQuestions.map(({ key, text }) => (
                                <button
                                    key={key}
                                    type="button"
                                    className="mx-2 my-1 px-3 py-1  // Updated margin and padding here
            text-sm font-medium             // Increased font size and made it medium weight
            bg-slate-50 dark:bg-gray-500
            hover:bg-slate-100 dark:hover:bg-gray-600
            rounded border border-slate-200 dark:border-slate-600
            transition-colors"
                                    onClick={() => setQuestionsBasedOnSelection(key)}
                                >
                                    {text}
                                </button>
                            ))}
                        </div>       </form>
                </DialogContent>

            </Dialog>
        </>
    );
};

export default Walkie;
