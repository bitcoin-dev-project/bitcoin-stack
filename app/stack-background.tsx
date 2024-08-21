import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { ChevronUp, ChevronDown, X } from 'lucide-react';

const StackItem = ({ item, index }) => (
  <Draggable draggableId={item.id} index={index}>
    {(provided) => (
      <div
        ref={provided.innerRef}
        {...provided.draggableProps}
        {...provided.dragHandleProps}
        className="bg-yellow-200 border-2 border-yellow-400 rounded-md p-2 mb-2 flex items-center justify-between"
      >
        <span>{item.content}</span>
        <X className="text-red-500 cursor-pointer" size={16} />
      </div>
    )}
  </Draggable>
);

const BitcoinStackBackground = () => {
  const [stack, setStack] = useState([
    { id: 'item1', content: 'OP_ADD' },
    { id: 'item2', content: '5' },
    { id: 'item3', content: '3' },
  ]);

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(stack);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setStack(items);
  };

  return (
    <div className="h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-4">Bitcoin Script Stack Builder</h1>
      <div className="flex">
        <div className="w-1/2 pr-4">
          <h2 className="text-xl font-semibold mb-2">Available Operations</h2>
          <div className="bg-white p-4 rounded-md shadow">
            <button className="bg-blue-500 text-white px-4 py-2 rounded mr-2 mb-2">OP_ADD</button>
            <button className="bg-blue-500 text-white px-4 py-2 rounded mr-2 mb-2">OP_SUB</button>
            <button className="bg-blue-500 text-white px-4 py-2 rounded mr-2 mb-2">OP_MUL</button>
            <button className="bg-green-500 text-white px-4 py-2 rounded mr-2 mb-2">Push Number</button>
          </div>
        </div>
        <div className="w-1/2 pl-4">
          <h2 className="text-xl font-semibold mb-2">Your Stack</h2>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="stack">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="bg-white p-4 rounded-md shadow min-h-[300px]"
                >
                  {stack.map((item, index) => (
                    <StackItem key={item.id} item={item} index={index} />
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          <div className="mt-4 flex justify-between">
            <button className="bg-purple-500 text-white px-4 py-2 rounded flex items-center">
              <ChevronUp size={16} className="mr-1" /> Push
            </button>
            <button className="bg-orange-500 text-white px-4 py-2 rounded flex items-center">
              <ChevronDown size={16} className="mr-1" /> Pop
            </button>
            <button className="bg-red-500 text-white px-4 py-2 rounded">Clear Stack</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BitcoinStackBackground;