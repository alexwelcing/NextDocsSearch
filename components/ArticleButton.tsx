import styled from 'styled-components';

const ArticleButton = styled.button`
  /* Add your desired button styling here. */
`;

export function ArticleControls({ onNext, onPrev }: { onNext: () => void; onPrev: () => void; }) {
  return (
    <div>
      <ArticleButton onClick={onPrev}>Prev</ArticleButton>
      <ArticleButton onClick={onNext}>Next</ArticleButton>
    </div>
  );
}
