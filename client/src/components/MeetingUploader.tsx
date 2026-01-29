import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  DatePicker,
  Upload,
  Tabs,
  Button,
  message
} from 'antd';
import { InboxOutlined, FileTextOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import dayjs from 'dayjs';
import { createMeeting, uploadMeeting } from '../services/api';

const { TextArea } = Input;
const { Dragger } = Upload;

interface MeetingUploaderProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const MeetingUploader: React.FC<MeetingUploaderProps> = ({
  open,
  onClose,
  onSuccess
}) => {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('paste');
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (activeTab === 'paste') {
        await createMeeting({
          title: values.title,
          content: values.content,
          meetingDate: values.meetingDate?.toISOString()
        });
        message.success('会议纪要创建成功');
      } else {
        if (fileList.length === 0) {
          message.error('请上传文件');
          return;
        }
        const formData = new FormData();
        formData.append('file', fileList[0].originFileObj as File);
        formData.append('title', values.title);
        if (values.meetingDate) {
          formData.append('meetingDate', values.meetingDate.toISOString());
        }
        await uploadMeeting(formData);
        message.success('文件上传成功');
      }

      form.resetFields();
      setFileList([]);
      onSuccess();
      onClose();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setFileList([]);
    onClose();
  };

  const uploadProps = {
    maxCount: 1,
    fileList,
    beforeUpload: (file: File) => {
      const isValid =
        file.type === 'application/pdf' ||
        file.type === 'application/msword' ||
        file.type ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.type === 'text/plain' ||
        file.name.endsWith('.pdf') ||
        file.name.endsWith('.doc') ||
        file.name.endsWith('.docx') ||
        file.name.endsWith('.txt');
      if (!isValid) {
        message.error('只支持 PDF、Word、TXT 格式');
        return false;
      }
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('文件大小不能超过 10MB');
        return false;
      }
      return false; // Prevent auto upload
    },
    onChange: (info: { fileList: UploadFile[] }) => {
      setFileList(info.fileList);
      // Auto-fill title from filename
      if (info.fileList.length > 0 && !form.getFieldValue('title')) {
        const fileName = info.fileList[0].name.replace(/\.[^/.]+$/, '');
        form.setFieldsValue({ title: fileName });
      }
    },
    onRemove: () => {
      setFileList([]);
    }
  };

  const tabItems = [
    {
      key: 'paste',
      label: (
        <span>
          <FileTextOutlined />
          文本粘贴
        </span>
      ),
      children: (
        <Form.Item
          name="content"
          label="会议内容"
          rules={[
            { required: activeTab === 'paste', message: '请输入会议内容' }
          ]}
        >
          <TextArea
            rows={10}
            placeholder="请粘贴会议纪要内容..."
            style={{ resize: 'none' }}
          />
        </Form.Item>
      )
    },
    {
      key: 'upload',
      label: (
        <span>
          <InboxOutlined />
          文件上传
        </span>
      ),
      children: (
        <Form.Item label="上传文件">
          <Dragger {...uploadProps}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此区域</p>
            <p className="ant-upload-hint">
              支持 PDF、Word (.doc/.docx)、TXT 格式，单文件不超过 10MB
            </p>
          </Dragger>
        </Form.Item>
      )
    }
  ];

  return (
    <Modal
      title="新建会议纪要"
      open={open}
      onCancel={handleCancel}
      width={700}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={loading}
          onClick={handleSubmit}
        >
          创建
        </Button>
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          meetingDate: dayjs()
        }}
      >
        <Form.Item
          name="title"
          label="会议标题"
          rules={[{ required: true, message: '请输入会议标题' }]}
        >
          <Input placeholder="请输入会议标题" />
        </Form.Item>

        <Form.Item name="meetingDate" label="会议日期">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
      </Form>
    </Modal>
  );
};

export default MeetingUploader;
