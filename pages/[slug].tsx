import { GetStaticPaths, GetStaticProps, GetStaticPropsContext } from 'next';
import { ParsedUrlQuery } from 'querystring';
import React from 'react';
import axios from 'axios';
import ArticleContainer from '../components/ArticleContainer';
import ArticleHeader from '../components/ArticleHeader';
import ArticleContent from '../components/ArticleContent';
import ArticleFooter from '../components/ArticleFooter';
import StructuredDataComponent from '../components/StructuredData';


interface ArticlePageProps {
  content: string;
  meta: {
    title: string;
  };
}

interface Params extends ParsedUrlQuery {
  slug: string;
}

export const getStaticPaths: GetStaticPaths<Params> = async () => {
  const res = await axios.get('/api/articles');
  const articles = res.data;

  const paths = articles.map((article: any) => ({
    params: { slug: article.filename.replace('.mdx', '') },
  }));

  return {
    paths,
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<ArticlePageProps, Params> = async (context: GetStaticPropsContext<Params>) => {
  const slug = context.params!.slug;
  const res = await axios.get(`/api/articles/${slug}`);
  const article = res.data;

  return {
    props: {
      content: article.content,
      meta: {
        title: article.title,
      },
    },
  };
};

const ArticlePage: React.FC<ArticlePageProps> = ({ content, meta }) => {
  return (
    <ArticleContainer>
      <StructuredDataComponent />
      <ArticleHeader title={meta.title} />
      <ArticleContent content={content} />
      <ArticleFooter />
    </ArticleContainer>
  );
};

export default ArticlePage;
