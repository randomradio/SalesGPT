import React from 'react';
import Image from 'next/image';

const Title = ({
  title
}: {
  title: string;
}) => {
  return (
    <div className="flex items-center h-12 pl-4">
      <Image src='/bot_logo.png' alt="logo" width={24} height={24} className="mr-2" />
      <h2 className="text-base font-medium text-[#262626]">{title}</h2>
    </div>
  );
}

export default Title;