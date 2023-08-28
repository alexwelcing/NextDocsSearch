import React from 'react';

interface AuthorProps {
  name: string;
  bio: string;
}

const Author: React.FC<AuthorProps> = ({ name, bio }) => {
  return (
    <div className="author">
      <span className="author-name">{name}</span>
      <span className="author-bio">{bio}</span>
    </div>
  );
};

export default Author;
