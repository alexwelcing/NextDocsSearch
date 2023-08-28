import React from 'react';

interface TagProps {
  text: string;
}

const Tag: React.FC<TagProps> = ({ text }) => {
  return <span className="tag">{text}</span>;
};

export default Tag;
