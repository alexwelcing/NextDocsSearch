import styled from 'styled-components';

const ArticleContainer = styled.div`
  width: 8em;
  height: 12em;
  overflow-y: auto;
  background-color: #fff;
  color: black;
  padding: 1em;
  box-shadow: 0px 0px 5px 2px rgba(0, 0, 0, 0.2);
`;

export const ArticleText = ({ text }: { text: string }) => (
  <ArticleContainer>
    {text}
  </ArticleContainer>
);
