import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  pageSize,
  onPageChange,
  onPageSizeChange,
  hasNextPage,
  hasPrevPage,
}) => {
  const pageSizeOptions = [25, 50, 100, 200];

  // Gerar range de páginas para exibir
  const getPageRange = () => {
    const range: (number | 'ellipsis')[] = [];
    const delta = 2; // Páginas antes/depois da atual

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - delta && i <= currentPage + delta)
      ) {
        range.push(i);
      } else if (range[range.length - 1] !== 'ellipsis') {
        range.push('ellipsis');
      }
    }

    return range;
  };

  if (totalItems === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      {/* Info e seletor de tamanho */}
      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
        <span>
          Mostrando {startIndex + 1}-{endIndex} de {totalItems}
        </span>
        
        <div className="flex items-center gap-2">
          <label htmlFor="pageSize" className="text-xs">
            Por página:
          </label>
          <select
            id="pageSize"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Controles de página */}
      <div className="flex items-center gap-1">
        {/* Primeira página */}
        <button
          onClick={() => onPageChange(1)}
          disabled={!hasPrevPage}
          className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Primeira página"
        >
          ««
        </button>

        {/* Anterior */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPrevPage}
          className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Página anterior"
        >
          «
        </button>

        {/* Números de página */}
        <div className="flex items-center gap-1 mx-2">
          {getPageRange().map((page, idx) =>
            page === 'ellipsis' ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">
                ...
              </span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`
                  px-3 py-1 text-xs rounded
                  ${
                    page === currentPage
                      ? 'bg-indigo-600 text-white'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
              >
                {page}
              </button>
            )
          )}
        </div>

        {/* Próxima */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNextPage}
          className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Próxima página"
        >
          »
        </button>

        {/* Última página */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={!hasNextPage}
          className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Última página"
        >
          »»
        </button>
      </div>
    </div>
  );
};

export default Pagination;
