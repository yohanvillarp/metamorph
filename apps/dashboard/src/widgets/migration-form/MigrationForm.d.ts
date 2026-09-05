interface MigrationFormProps {
    onStart: (targetPath: string, fromFw: string, toFw: string) => void;
    isStarting: boolean;
    startError: string | null;
}
export declare const MigrationForm: ({ onStart, isStarting, startError }: MigrationFormProps) => import("react").JSX.Element;
export {};
