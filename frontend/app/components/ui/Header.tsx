import React from 'react';
import Image from 'next/image';

const Header = () => (
  <header className="flex items-center justify-center h-[80px] text-white flex-shrink-0" style={{ background: 'linear-gradient(90deg, #004FFF 0%, #16D7F6 100%)' }}>
    <Image src='/logo.png' alt="logo" width={32} height={32} className="mr-2" />
    <h1 className="text-2xl font-semibold text-[#F5F5F5]">营销流程助手</h1>
  </header>
);

export default Header;