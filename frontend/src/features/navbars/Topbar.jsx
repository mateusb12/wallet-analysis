import React from 'react';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../auth/AuthContext';

export default function TopBar({ onMobileMenuOpen }) {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'U';

  const userName =
    user?.user_metadata?.full_name || (user?.email ? user.email.split('@')[0] : 'Usuário');
  const userAvatarUrl = user?.user_metadata?.avatar_url;

  return (
    <header className="h-20 bg-white dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 flex items-center justify-between px-4 lg:px-8 transition-colors duration-200 z-10">
      {}
      <div className="flex items-center gap-4">
        <button
          onClick={onMobileMenuOpen}
          className="md:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <span className="sr-only">Open menu</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            />
          </svg>
        </button>

        {}
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white hidden sm:block tracking-tight">
            Sistema de Investimentos
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 sm:hidden font-semibold">
            Investimentos
          </p>
        </div>
      </div>

      {}
      <div className="flex items-center gap-2 sm:gap-4">
        {}
        <button className="relative p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-700/50">
          <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-800"></div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
            />
          </svg>
        </button>

        {}
        <button
          onClick={toggleTheme}
          className="p-2 text-gray-400 hover:text-yellow-500 dark:hover:text-yellow-300 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-700/50"
          title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
        >
          {theme === 'dark' ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
              />
            </svg>
          )}
        </button>

        {}
        {}
        <div className="h-8 w-px bg-gray-300 dark:bg-gray-700 mx-1 hidden sm:block"></div>

        {}
        <div className="flex items-center gap-3 pl-2">
          <div className="text-right hidden md:block">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 leading-none">
              {userName}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 font-medium">
              Administrador
            </p>
          </div>

          {userAvatarUrl ? (
            <img
              src={userAvatarUrl}
              alt="Profile"
              className="h-10 w-10 rounded-full object-cover shadow-md shadow-blue-500/20 ring-2 ring-white dark:ring-gray-700"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/20 ring-2 ring-white dark:ring-gray-700">
              {userInitial}
            </div>
          )}

          {}
          <button
            onClick={signOut}
            title="Sair"
            className="ml-2 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-400 rounded-lg transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
