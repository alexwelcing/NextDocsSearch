import React from 'react';

interface PDFLinksProps {
  files: string[];
}

const PDFLinks: React.FC<PDFLinksProps> = ({ files }) => {
  const formatFileName = (filename: string): string => {
    let formattedName = filename.replace(/_/g, ' ');
    formattedName = formattedName.replace('.pdf', '');
    formattedName = formattedName.replace('Alex Welcing', '');
    return formattedName.trim();
  };

  return (
    <div className="pdf-links-container">
      {files.map((file, index) => (
        <a
          key={index}
          href={`/resumes/${file}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            backgroundColor: 'var(--retro-4)',
            color: '#ffffff',
          }}
          className="inline-block text-center font-bold py-2 px-8 mr-4 rounded-full transition duration-300 ease-in-out transform hover:-translate-y-1"
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--btn-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--retro-4)';
          }}
        >
          {formatFileName(file)}
        </a>
      ))}
    </div>
  );
};

export default PDFLinks;
