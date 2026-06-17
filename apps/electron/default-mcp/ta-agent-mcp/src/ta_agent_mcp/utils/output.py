"""
输出格式化工具
"""

from typing import List, Optional


def format_result(data: dict, message: Optional[str] = None) -> dict:
    """
    格式化成功结果

    Args:
        data: 结果数据
        message: 可选的消息

    Returns:
        格式化的结果字典
    """
    result = {"success": True, "data": data}
    if message:
        result["message"] = message
    return result


def format_error(error: str, details: Optional[dict] = None) -> dict:
    """
    格式化错误结果

    Args:
        error: 错误消息
        details: 可选的错误详情

    Returns:
        格式化的错误字典
    """
    result = {"success": False, "error": error}
    if details:
        result["details"] = details
    return result


def format_list(items: List[dict], title: str = "Items") -> dict:
    """
    格式化列表结果

    Args:
        items: 项目列表
        title: 列表标题

    Returns:
        格式化的列表结果
    """
    return {"success": True, "data": {"title": title, "count": len(items), "items": items}}
