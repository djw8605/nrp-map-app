import {RiCpuLine, RiServerLine, RiDatabase2Line, RiBookOpenLine} from '@remixicon/react';

export default function NavBar() {
  return (
    <>
      <nav className="px-2 sm:px-4 py-5 bg-background-blue">
        <div className="container mx-auto">
          <div className="container flex flex-wrap justify-between items-center mx-auto">
            <a href="/" className="flex items-center">
              <span className="self-center text-xl font-semibold whitespace-nowrap text-white">National Research Platform</span>
            </a>
            <a
              href="https://nationalresearchplatform.org/documentation" // Replace with the actual URL of the documentation
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-blue-700 hover:bg-gray-200 font-bold py-2 px-4 rounded shadow-md flex items-center"
            >
              <RiBookOpenLine className="mr-2" /> Docs
            </a>
          </div>
        </div>
      </nav>
    </>
  );
}