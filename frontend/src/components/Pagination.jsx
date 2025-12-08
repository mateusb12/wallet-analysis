import React from 'react';

const range = (start, end) => {
  let length = end - start + 1;
  return Array.from({ length }, (_, idx) => idx + start);
};

function Pagination({ currentPage, totalPages, onPageChange }) {
  const siblings = 1;

  const totalPageNumbers = siblings * 2 + 5;

  if (totalPageNumbers >= totalPages) {
    const pages = range(1, totalPages);
    return (
      <nav className="flex justify-center items-center space-x-1">
        <PaginationButton onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1}>
          &larr;
        </PaginationButton>
        {pages.map((page) => (
          <PaginationButton
            key={page}
            onClick={() => onPageChange(page)}
            isActive={page === currentPage}
          >
            {page}
          </PaginationButton>
        ))}
        <PaginationButton
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          &rarr;
        </PaginationButton>
      </nav>
    );
  }

  const leftSiblingIndex = Math.max(currentPage - siblings, 1);
  const rightSiblingIndex = Math.min(currentPage + siblings, totalPages);

  const showLeftEllipsis = leftSiblingIndex > 2;
  const showRightEllipsis = rightSiblingIndex < totalPages - 2;

  const firstPageIndex = 1;
  const lastPageIndex = totalPages;

  let pages = [];

  pages.push(firstPageIndex);

  if (showLeftEllipsis) {
    pages.push('...');
  }

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftItemCount = 3 + 2 * siblings;
    pages = [...pages, ...range(2, leftItemCount)];
  } else if (showLeftEllipsis && !showRightEllipsis) {
    const rightItemCount = 3 + 2 * siblings;
    pages = [...pages, ...range(totalPages - rightItemCount + 2, totalPages - 1)];
  } else if (showLeftEllipsis && showRightEllipsis) {
    pages = [...pages, ...range(leftSiblingIndex, rightSiblingIndex)];
  }

  if (showRightEllipsis) {
    pages.push('...');
  }

  pages.push(lastPageIndex);

  const uniquePages = [...new Set(pages)];

  return (
    <nav className="flex justify-center items-center space-x-1">
      <PaginationButton onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1}>
        &larr;
      </PaginationButton>

      {uniquePages.map((page, index) => {
        if (page === '...') {
          return (
            <span key={`ellipsis-${index}`} className="px-3 py-1 text-gray-500">
              ...
            </span>
          );
        }

        return (
          <PaginationButton
            key={page}
            onClick={() => onPageChange(page)}
            isActive={page === currentPage}
          >
            {page}
          </PaginationButton>
        );
      })}

      <PaginationButton
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
      >
        &rarr;
      </PaginationButton>
    </nav>
  );
}

function PaginationButton({ onClick, disabled, isActive, children }) {
  const baseStyle = 'px-3 py-1 rounded transition-colors duration-150 text-sm font-medium';
  const activeStyle = 'bg-blue-600 text-white';
  const defaultStyle = 'bg-gray-200 hover:bg-gray-300 text-gray-700';
  const disabledStyle = 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50';

  let style = isActive ? activeStyle : defaultStyle;
  if (disabled) style = disabledStyle;

  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${style}`}>
      {children}
    </button>
  );
}

export default Pagination;
