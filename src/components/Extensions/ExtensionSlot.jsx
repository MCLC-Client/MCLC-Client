import React from 'react';
import { useExtensions } from '../../context/ExtensionContext';

class ExtensionErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Extension Slot Error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return <div className="text-red-500 text-xs p-2 bg-red-500/10 rounded">Extension Error</div>;
        }

        return this.props.children;
    }
}

const ExtensionSlot = ({ name, className }) => {
    const { getViews } = useExtensions();
    const views = getViews(name);

    if (views.length === 0) return null;

    return (
        <div className={className}>
            {views.map(view => {
                const Component = view.component;
                return (
                    <ExtensionErrorBoundary key={view.id}>
                        <Component />
                    </ExtensionErrorBoundary>
                );
            })}
        </div>
    );
};

export default ExtensionSlot;
