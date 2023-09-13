import { GetStaticPaths, GetStaticProps, NextPage } from 'next';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import ReactMarkdown from 'react-markdown';
import ArticleContainer from '@/components/ArticleContainer';
import Footer from '../../components/ui/footer';
import ArticleHeader from '@/components/ArticleHeader';
import CircleNav from '@/components/ui/CircleNav';
import mermaid from 'mermaid';
import { useEffect } from 'react';


interface ArticleProps {
  title: string;
  date: string;
  author: string[];
  content: string;
}

const ArticlePage: NextPage<ArticleProps> = ({ title, date, author, content }) => {

  useEffect(() => {
    mermaid.initialize({ startOnLoad: true });
  }, []);

  return (
    <div>
      <CircleNav />
      <ArticleContainer>
        <ArticleHeader title={title} />
        <div className="article-content">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </ArticleContainer>
      <Footer onImageChange={function (newImage: string): void {
        throw new Error('Function not implemented.');
      }} showChangeScenery={false} />
    </div>
  );
};

export const getStaticPaths: GetStaticPaths = async () => {
  const articleFolderPath = path.join(process.cwd(), 'pages', 'docs', 'articles');
  const filenames = fs.readdirSync(articleFolderPath);
  const paths = filenames
    .filter((filename) => filename.endsWith('.mdx')) // Only include .mdx files
    .map((filename) => ({
      params: { slug: filename.replace('.mdx', '') },
    }));
  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const { slug } = params as { slug: string };
  const articleFilePath = path.join(process.cwd(), 'pages', 'docs', 'articles', `${slug}.mdx`);
  const fileContents = fs.readFileSync(articleFilePath, 'utf8');
  const { data, content } = matter(fileContents);

  return {
    props: {
      title: data.title as string,
      date: data.date as string,
      author: data.author as string[],
      content,
    },
  };
};

export default ArticlePage;
