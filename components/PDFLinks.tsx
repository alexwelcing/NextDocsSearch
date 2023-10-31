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
    <div className="pdf-links-container flex flex-col items-center space-y-4 md:space-y-0 md:flex-row md:items-start">
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
          className="w-full md:w-auto text-center font-bold py-2 px-8 md:mr-4 rounded-full transition duration-300 ease-in-out transform hover:-translate-y-1"
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
