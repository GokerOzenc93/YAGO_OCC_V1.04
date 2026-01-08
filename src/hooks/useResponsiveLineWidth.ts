import { useEffect, useState } from 'react';

interface LineWidths {
  thin: number;
  normal: number;
  medium: number;
  thick: number;
}

export const useResponsiveLineWidth = (): LineWidths => {
  const [lineWidths, setLineWidths] = useState<LineWidths>({
    thin: 1.5,
    normal: 2.5,
    medium: 3,
    thick: 3.5
  });

  useEffect(() => {
    const updateLineWidths = () => {
      const width = window.innerWidth;

      if (width < 640) {
        setLineWidths({
          thin: 0.8,
          normal: 1.2,
          medium: 1.5,
          thick: 1.8
        });
      } else if (width < 1024) {
        setLineWidths({
          thin: 1,
          normal: 1.8,
          medium: 2.2,
          thick: 2.5
        });
      } else {
        setLineWidths({
          thin: 1.5,
          normal: 2.5,
          medium: 3,
          thick: 3.5
        });
      }
    };

    updateLineWidths();
    window.addEventListener('resize', updateLineWidths);

    return () => {
      window.removeEventListener('resize', updateLineWidths);
    };
  }, []);

  return lineWidths;
};
